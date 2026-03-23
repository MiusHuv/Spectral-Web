import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TaxonomyTree from '../TaxonomyTree';
import { AppProvider } from '../../../context/AppContext';
import { apiClient } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiClient: {
    getClassificationMetadata: vi.fn(),
    getClassificationAsteroidsPage: vi.fn(),
    getAsteroid: vi.fn(),
    getSpectrum: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}));

const mockClassificationAsteroids = {
  S: [
    {
      id: 1,
      official_number: 433,
      proper_name: 'Eros',
      bus_demeo_class: 'S',
      tholen_class: 'S',
      has_spectral_data: true,
    },
    {
      id: 2,
      official_number: 25143,
      proper_name: 'Itokawa',
      bus_demeo_class: 'S',
      tholen_class: 'S',
      has_spectral_data: true,
    },
  ],
  C: [
    {
      id: 3,
      official_number: 1,
      proper_name: 'Ceres',
      bus_demeo_class: 'C',
      tholen_class: 'C',
      has_spectral_data: true,
    },
  ],
  X: [],
} as const;

const buildMetadata = (system: 'bus_demeo' | 'tholen' = 'bus_demeo') => ({
  system,
  classes: Object.entries(mockClassificationAsteroids).map(([name, asteroids]) => ({
    name,
    total_count: asteroids.length,
    spectral_count: asteroids.length,
    spectral_percentage: asteroids.length === 0 ? 0 : 100,
  })),
  total_asteroids: Object.values(mockClassificationAsteroids).flat().length,
  total_with_spectra: Object.values(mockClassificationAsteroids).flat().length,
  overall_spectral_percentage: 100,
});

const buildPageResponse = (classificationName: string) => {
  const asteroids = mockClassificationAsteroids[classificationName as keyof typeof mockClassificationAsteroids] ?? [];
  return {
    asteroids,
    pagination: {
      page: 1,
      pageSize: 100,
      total: asteroids.length,
      totalPages: 1,
      hasMore: false,
      hasPrevious: false,
    },
  };
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppProvider>{children}</AppProvider>
);

const getClassificationHeader = (name: string): HTMLElement => {
  const headers = Array.from(document.querySelectorAll('.classification-header'));
  const header = headers.find((element) => {
    const label = element.querySelector('.classification-name');
    return label?.textContent === name;
  });

  if (!(header instanceof HTMLElement)) {
    throw new Error(`Classification header not found for ${name}`);
  }

  return header;
};

describe('TaxonomyTree', () => {
  const mockGetClassificationMetadata = vi.mocked(apiClient.getClassificationMetadata);
  const mockGetClassificationAsteroidsPage = vi.mocked(apiClient.getClassificationAsteroidsPage);
  const mockGetAsteroid = vi.mocked(apiClient.getAsteroid);
  const mockGetSpectrum = vi.mocked(apiClient.getSpectrum);

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetClassificationMetadata.mockImplementation(async (system) => buildMetadata(system));
    mockGetClassificationAsteroidsPage.mockImplementation(async (_system, classificationName) =>
      buildPageResponse(classificationName) as any
    );
    mockGetAsteroid.mockImplementation(async (id: number) => ({
      asteroid:
        Object.values(mockClassificationAsteroids)
          .flat()
          .find((asteroid) => asteroid.id === id) ?? { id },
    }) as any);
    mockGetSpectrum.mockImplementation(async (id: number) => ({
      spectrum: {
        asteroid_id: id,
        wavelengths: [0.45, 0.55, 0.65],
        reflectances: [0.9, 1.0, 1.1],
        normalized: true,
      },
    }) as any);
  });

  it('renders loading state initially', () => {
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    expect(screen.getByText('Loading classification metadata...')).toBeInTheDocument();
  });

  it('renders classification tree after loading', async () => {
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(getClassificationHeader('S')).toHaveTextContent('(2)');
    expect(getClassificationHeader('C')).toHaveTextContent('(1)');
    expect(getClassificationHeader('X')).toHaveTextContent('(0)');
  });

  it('expands and collapses classification nodes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    expect(screen.queryByText('Eros')).not.toBeInTheDocument();

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
      expect(screen.getByText('Itokawa')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.queryByText('Eros')).not.toBeInTheDocument();
    });
  });

  it('handles asteroid selection and deselection', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    expect(screen.getByText('0 of 10 selected')).toBeInTheDocument();
    expect(screen.getByText('10 remaining')).toBeInTheDocument();

    const erosCheckbox = screen.getByRole('checkbox', { name: /Select Eros/ });
    await user.click(erosCheckbox);

    await waitFor(() => {
      expect(screen.getByText('1 of 10 selected')).toBeInTheDocument();
      expect(screen.getByText('9 remaining')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Clear all selected asteroids' })
      ).toBeInTheDocument();
    });

    await user.click(erosCheckbox);

    await waitFor(() => {
      expect(screen.getByText('0 of 10 selected')).toBeInTheDocument();
      expect(screen.getByText('10 remaining')).toBeInTheDocument();
    });
  });

  it('handles multiple asteroid selections across classifications', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    expect(screen.getByText('2 of 10 selected')).toBeInTheDocument();
    expect(screen.getByText('8 remaining')).toBeInTheDocument();

    await user.click(getClassificationHeader('C'));

    await waitFor(() => {
      expect(screen.getByText('Ceres')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Ceres/ }));

    expect(screen.getByText('3 of 10 selected')).toBeInTheDocument();
    expect(screen.getByText('7 remaining')).toBeInTheDocument();
  });

  it('clears all selections when the clear button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    await user.click(screen.getByRole('button', { name: 'Clear all selected asteroids' }));

    await waitFor(() => {
      expect(screen.getByText('0 of 10 selected')).toBeInTheDocument();
      expect(screen.getByText('10 remaining')).toBeInTheDocument();
    });
  });

  it('enforces the maximum selection limit', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={2} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    await user.click(getClassificationHeader('C'));

    await waitFor(() => {
      expect(screen.getByText('Ceres')).toBeInTheDocument();
    });

    expect(screen.getByRole('checkbox', { name: /Select Ceres/ })).toBeDisabled();
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();
  });

  it('switches between classification systems', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bus-DeMeo')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('System:'), 'tholen');

    await waitFor(() => {
      expect(mockGetClassificationMetadata).toHaveBeenCalledWith('tholen');
    });
  });

  it('handles empty classification state', async () => {
    mockGetClassificationMetadata.mockResolvedValueOnce({
      system: 'bus_demeo',
      classes: [],
      total_asteroids: 0,
      total_with_spectra: 0,
      overall_spectral_percentage: 0,
    } as any);

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('No classifications found for the selected system.')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles empty asteroid lists in a classification', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('X'));

    await waitFor(() => {
      expect(screen.getByText('No asteroids found in this classification.')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockGetClassificationMetadata.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('displays the correct asteroid names based on available data', async () => {
    const user = userEvent.setup();

    mockGetClassificationMetadata.mockResolvedValueOnce({
      system: 'bus_demeo',
      classes: [{ name: 'Test', total_count: 4, spectral_count: 4, spectral_percentage: 100 }],
      total_asteroids: 4,
      total_with_spectra: 4,
      overall_spectral_percentage: 100,
    } as any);
    mockGetClassificationAsteroidsPage.mockResolvedValueOnce({
      asteroids: [
        { id: 1, proper_name: 'Named Asteroid', official_number: 123, bus_demeo_class: 'S' },
        { id: 2, official_number: 456, bus_demeo_class: 'S' },
        { id: 3, provisional_designation: '2023 AB1', bus_demeo_class: 'S' },
        { id: 4, bus_demeo_class: 'S' },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 4,
        totalPages: 1,
        hasMore: false,
        hasPrevious: false,
      },
    } as any);

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('Test'));

    await waitFor(() => {
      expect(screen.getByText('Named Asteroid')).toBeInTheDocument();
      expect(screen.getByText('(456)')).toBeInTheDocument();
      expect(screen.getByText('2023 AB1')).toBeInTheDocument();
      expect(screen.getByText('Asteroid 4')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    const sHeader = getClassificationHeader('S');
    sHeader.focus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.keyboard(' ');

    await waitFor(() => {
      expect(screen.queryByText('Eros')).not.toBeInTheDocument();
    });
  });

  it('maintains selection state across classification system changes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    expect(screen.getByText('1 of 10 selected')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('System:'), 'tholen');

    await waitFor(() => {
      expect(screen.getByText('1 of 10 selected')).toBeInTheDocument();
    });
  });

  it('supports bulk selection for an expanded classification', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select All (2)')).not.toBeInTheDocument();

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Select All (2)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Select All (2)'));

    await waitFor(() => {
      expect(screen.getByText('2 of 10 selected')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Select Eros/ })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Select Itokawa/ })).toBeChecked();
    });
  });

  it('disables bulk select when no more selections are allowed', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));

    expect(screen.getByText('Select All (2)')).toBeDisabled();
  });

  it('shows and clears bulk-selection errors correctly', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      expect(screen.getByText('Select All (2)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Select All (2)'));

    expect(
      screen.getByText('Cannot select 2 asteroids. Only 1 selections remaining.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('button', { name: 'Clear all selected asteroids' }));

    await waitFor(() => {
      expect(
        screen.queryByText('Cannot select 2 asteroids. Only 1 selections remaining.')
      ).not.toBeInTheDocument();
    });
  });

  it('exposes the expected accessibility labels', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(getClassificationHeader('S'));

    await waitFor(() => {
      const bulkSelectBtn = screen.getByRole('button', { name: 'Select All (2)' });
      expect(bulkSelectBtn).toHaveAttribute('title', 'Select all 2 asteroids in this classification');
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));

    expect(
      screen.getByRole('button', { name: 'Clear all selected asteroids' })
    ).toBeInTheDocument();
  });
});
