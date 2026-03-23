import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../components/App';
import HomePage from '../components/pages/NewHomePage';
import TaxonomyTree from '../components/taxonomy/TaxonomyTree';
import SpectralChart from '../components/spectral/SpectralChart';
import PropertiesPanel from '../components/properties/PropertiesPanel';
import ExportManager from '../components/export/ExportManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { AppProvider, Asteroid } from '../context/AppContext';
import { CartProvider } from '../contexts/CartContext';
import {
  VIEWPORT_SIZES,
  setViewport,
  mockMediaQuery,
  isElementVisible,
  getFontSizeInPx,
} from './responsive-utils';

vi.mock('../services/api', () => ({
  apiClient: {
    getClassificationMetadata: vi.fn(async () => ({
      system: 'bus_demeo',
      classes: [
        { name: 'C', total_count: 1, spectral_count: 1, spectral_percentage: 100 },
        { name: 'S', total_count: 2, spectral_count: 2, spectral_percentage: 100 },
      ],
      total_asteroids: 3,
      total_with_spectra: 3,
      overall_spectral_percentage: 100,
    })),
    getClassificationAsteroidsPage: vi.fn(async (_system: string, classificationName: string) => ({
      asteroids:
        classificationName === 'S'
          ? [
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
            ]
          : [
              {
                id: 3,
                official_number: 1,
                proper_name: 'Ceres',
                bus_demeo_class: 'C',
                tholen_class: 'C',
                has_spectral_data: true,
              },
            ],
      pagination: {
        page: 1,
        pageSize: 100,
        total: classificationName === 'S' ? 2 : 1,
        totalPages: 1,
        hasMore: false,
        hasPrevious: false,
      },
    })),
    getAsteroid: vi.fn(async (id: number) => ({
      asteroid: {
        id,
        official_number: id,
        proper_name: id === 3 ? 'Ceres' : `Asteroid ${id}`,
        has_spectral_data: true,
      },
    })),
    getSpectrum: vi.fn(async (id: number) => ({
      spectrum: {
        asteroid_id: id,
        wavelengths: [0.45, 0.55, 0.65],
        reflectances: [0.9, 1.0, 1.1],
        normalized: true,
      },
    })),
    exportData: vi.fn(),
    exportSpectrum: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    getErrorMessage: vi.fn((error: Error) => error.message || 'Unknown error'),
  },
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AppProvider>
        <CartProvider>{ui}</CartProvider>
      </AppProvider>
    </MemoryRouter>
  );

const asteroidStatsResponse = {
  stats: {
    total_asteroids: 12345,
    total_observations: 67890,
    bus_demeo_classes: 24,
    tholen_classes: 12,
  },
};

const selectedAsteroids: Asteroid[] = [
  {
    id: 1,
    official_number: 1,
    proper_name: 'Ceres',
    orbital_elements: { semi_major_axis: 2.77 },
    physical_properties: { diameter: 939.4 },
  } as Asteroid,
];

const spectralData = [
  {
    asteroid_id: 1,
    wavelengths: [0.5, 0.6, 0.7],
    reflectances: [0.9, 1.0, 1.1],
    normalized: true,
  },
];

describe('Responsive Design System', () => {
  beforeEach(() => {
    setViewport(VIEWPORT_SIZES.find((viewport) => viewport.name === 'Desktop Medium')!);
    mockMediaQuery('(min-width: 768px)', true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => asteroidStatsResponse,
      }))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('App Shell', () => {
    it('renders the current home experience inside the application shell', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Asteroid & Meteorite Spectral Database')).toBeInTheDocument();
      });

      expect(document.querySelector('.app')).toBeInTheDocument();
      expect(document.querySelector('.new-home-page')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Browse Asteroids' })).toBeInTheDocument();
    });

    VIEWPORT_SIZES.forEach((viewport) => {
      it(`keeps the homepage content available on ${viewport.name}`, async () => {
        setViewport(viewport);

        renderWithProviders(<HomePage />);

        await waitFor(() => {
          expect(screen.getByText('Asteroid & Meteorite Spectral Database')).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText('Search by name, number, or classification...')).toBeVisible();
        expect(screen.getByText('Quick Links')).toBeVisible();
        expect(document.querySelector('.cards-grid')).toBeInTheDocument();
        expect(document.querySelector('.quick-links-grid')).toBeInTheDocument();
      });
    });

    it('keeps the main heading visible across representative viewport categories', async () => {
      const representativeViewports = [
        VIEWPORT_SIZES.find((viewport) => viewport.category === 'mobile')!,
        VIEWPORT_SIZES.find((viewport) => viewport.category === 'tablet')!,
        VIEWPORT_SIZES.find((viewport) => viewport.category === 'desktop')!,
      ];

      for (const viewport of representativeViewports) {
        setViewport(viewport);
        const { unmount } = renderWithProviders(<HomePage />);

        const heading = await screen.findByRole('heading', {
          level: 1,
          name: 'Asteroid & Meteorite Spectral Database',
        });

        expect(isElementVisible(heading)).toBe(true);
        expect(getFontSizeInPx(heading)).toBeGreaterThan(0);

        unmount();
      }
    });

    VIEWPORT_SIZES.filter((viewport) => viewport.category === 'mobile').forEach((viewport) => {
      it(`keeps primary controls accessible on ${viewport.name}`, async () => {
        setViewport(viewport);

        renderWithProviders(<HomePage />);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Browse Meteorites' })).toBeEnabled();
        expect(screen.getByTitle('View spectrum comparison cart')).toBeInTheDocument();
      });
    });
  });
});

describe('Responsive Utility Components', () => {
  beforeEach(() => {
    mockMediaQuery('(prefers-color-scheme: dark)', false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  VIEWPORT_SIZES.forEach((viewport) => {
    it(`renders LoadingSpinner cleanly on ${viewport.name}`, () => {
      setViewport(viewport);

      render(<LoadingSpinner size="medium" message="Loading..." />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeVisible();
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  VIEWPORT_SIZES.forEach((viewport) => {
    it(`renders ErrorMessage cleanly on ${viewport.name}`, () => {
      setViewport(viewport);

      render(
        <ErrorMessage
          message="Test error message"
          onRetry={() => undefined}
          dismissible={true}
          onDismiss={() => undefined}
        />
      );

      expect(screen.getByRole('alert')).toBeVisible();
      expect(screen.getByText('Test error message')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    });
  });
});

describe('Component Integration Responsive Tests', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => asteroidStatsResponse,
      }))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders TaxonomyTree with the current metadata API contract', async () => {
    renderWithProviders(<TaxonomyTree />);

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    expect(document.querySelector('.taxonomy-tree')).toBeInTheDocument();
    expect(screen.getByLabelText('System:')).toBeInTheDocument();
  });

  it('renders SpectralChart in a viewport-safe container', () => {
    render(<SpectralChart data={spectralData} />);

    expect(screen.getByTestId('spectral-chart')).toBeInTheDocument();
    expect(document.querySelector('.spectral-chart-wrapper')).toBeInTheDocument();
  });

  it('renders PropertiesPanel using the current prop-driven API', () => {
    render(
      <PropertiesPanel
        selectedAsteroids={[1]}
        asteroidData={selectedAsteroids}
      />
    );

    expect(document.querySelector('.properties-panel')).toBeInTheDocument();
    expect(screen.getByText('Asteroid Properties')).toBeInTheDocument();
    expect(screen.getAllByText('Ceres').length).toBeGreaterThan(0);
  });

  it('renders ExportManager with the current non-modal layout', () => {
    render(
      <ExportManager
        isOpen={true}
        onClose={() => undefined}
        selectedAsteroids={[1, 2]}
      />
    );

    expect(document.querySelector('.export-manager')).toBeInTheDocument();
    expect(screen.getByText('Selected asteroids:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('Performance and Accessibility', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => asteroidStatsResponse,
      }))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves key homepage content during viewport changes', async () => {
    const { rerender } = renderWithProviders(<HomePage />);

    for (const viewport of VIEWPORT_SIZES) {
      setViewport(viewport);
      rerender(
        <MemoryRouter>
          <AppProvider>
            <CartProvider>
              <HomePage />
            </CartProvider>
          </AppProvider>
        </MemoryRouter>
      );

      expect(await screen.findByText('Asteroid & Meteorite Spectral Database')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    }
  });

  it('maintains focus on the search input across viewport changes', async () => {
    renderWithProviders(<HomePage />);

    const input = await screen.findByPlaceholderText('Search by name, number, or classification...');
    input.focus();
    expect(document.activeElement).toBe(input);

    setViewport(VIEWPORT_SIZES.find((viewport) => viewport.category === 'mobile')!);

    expect(document.activeElement).toBe(input);
  });

  it('still renders loading feedback when reduced motion is requested', () => {
    mockMediaQuery('(prefers-reduced-motion: reduce)', true);

    render(<LoadingSpinner size="medium" />);

    expect(screen.getByTestId('loading-spinner')).toHaveAttribute('role', 'status');
    expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
  });
});

describe('Cross-browser Compatibility', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => asteroidStatsResponse,
      }))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders HomePage even if CSS custom properties are unavailable', async () => {
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    CSSStyleDeclaration.prototype.getPropertyValue = vi.fn().mockReturnValue('');

    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Asteroid & Meteorite Spectral Database')).toBeInTheDocument();

    CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
  });

  it('keeps LoadingSpinner accessible with fallback styles', () => {
    render(<LoadingSpinner size="medium" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
