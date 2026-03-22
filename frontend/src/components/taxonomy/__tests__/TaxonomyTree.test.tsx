import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TaxonomyTree from '../TaxonomyTree';
import { AppProvider } from '../../../context/AppContext';
import { apiClient } from '../../../services/api';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    getAsteroidsByClassification: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}));

// Mock data
const mockClassificationData = {
  classes: [
    {
      name: 'S',
      asteroids: [
        {
          id: 1,
          official_number: 433,
          proper_name: 'Eros',
          bus_demeo_class: 'S',
          tholen_class: 'S',
        },
        {
          id: 2,
          official_number: 25143,
          proper_name: 'Itokawa',
          bus_demeo_class: 'S',
          tholen_class: 'S',
        },
      ],
    },
    {
      name: 'C',
      asteroids: [
        {
          id: 3,
          official_number: 1,
          proper_name: 'Ceres',
          bus_demeo_class: 'C',
          tholen_class: 'C',
        },
      ],
    },
    {
      name: 'X',
      asteroids: [],
    },
  ],
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppProvider>{children}</AppProvider>
);

describe('TaxonomyTree', () => {
  const mockGetAsteroidsByClassification = vi.mocked(apiClient.getAsteroidsByClassification);

  beforeEach(() => {
    mockGetAsteroidsByClassification.mockResolvedValue(mockClassificationData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    expect(screen.getByText('Loading asteroid classifications...')).toBeInTheDocument();
  });

  it('renders classification tree after loading', async () => {
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Asteroid Classifications')).toBeInTheDocument();
    });

    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument(); // S class count
    expect(screen.getByText('(1)')).toBeInTheDocument(); // C class count
    expect(screen.getByText('(0)')).toBeInTheDocument(); // X class count
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

    // Initially collapsed - asteroids should not be visible
    expect(screen.queryByText('Eros')).not.toBeInTheDocument();

    // Click to expand S classification - find the classification header specifically
    const sClassificationHeader = screen.getByText('S').closest('.classification-header');
    expect(sClassificationHeader).toBeTruthy();
    await user.click(sClassificationHeader!);

    // Now asteroids should be visible
    expect(screen.getByText('Eros')).toBeInTheDocument();
    expect(screen.getByText('Itokawa')).toBeInTheDocument();

    // Click again to collapse
    await user.click(sClassificationHeader!);

    // Asteroids should be hidden again
    expect(screen.queryByText('Eros')).not.toBeInTheDocument();
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

    // Expand S classification
    await user.click(screen.getByText('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Check selection counter shows 0
    expect(screen.getByText('Selected: 0/10')).toBeInTheDocument();
    expect(screen.getByText('(10 remaining)')).toBeInTheDocument();

    // Select Eros
    const erosCheckbox = screen.getByRole('checkbox', { name: /Select Eros/ });
    await user.click(erosCheckbox);

    // Check selection counter updates
    expect(screen.getByText('Selected: 1/10')).toBeInTheDocument();
    expect(screen.getByText('(9 remaining)')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();

    // Deselect Eros
    await user.click(erosCheckbox);

    // Check selection counter resets
    expect(screen.getByText('Selected: 0/10')).toBeInTheDocument();
    expect(screen.getByText('(10 remaining)')).toBeInTheDocument();
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });

  it('handles multiple asteroid selections', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification
    await user.click(screen.getByText('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Select both asteroids in S class
    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    expect(screen.getByText('Selected: 2/10')).toBeInTheDocument();
    expect(screen.getByText('(8 remaining)')).toBeInTheDocument();

    // Expand C classification and select Ceres
    await user.click(screen.getByText('C'));
    
    await waitFor(() => {
      expect(screen.getByText('Ceres')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Ceres/ }));

    expect(screen.getByText('Selected: 3/10')).toBeInTheDocument();
    expect(screen.getByText('(7 remaining)')).toBeInTheDocument();
  });

  it('clears all selections when Clear All button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand and select asteroids
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    expect(screen.getByText('Selected: 2/10')).toBeInTheDocument();

    // Clear all selections
    await user.click(screen.getByText('Clear All'));

    expect(screen.getByText('Selected: 0/10')).toBeInTheDocument();
    expect(screen.getByText('(10 remaining)')).toBeInTheDocument();
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });

  it('enforces maximum selection limit', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={2} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Select first two asteroids
    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    expect(screen.getByText('Selected: 2/2')).toBeInTheDocument();
    expect(screen.getByText('(0 remaining)')).toBeInTheDocument();

    // Try to select a third asteroid
    await user.click(screen.getByText('C'));
    
    await waitFor(() => {
      expect(screen.getByText('Ceres')).toBeInTheDocument();
    });

    // The checkbox should be disabled, so clicking won't work
    const ceresCheckbox = screen.getByRole('checkbox', { name: /Select Ceres/ });
    expect(ceresCheckbox).toBeDisabled();
    
    // Selection count should remain at 2
    expect(screen.getByText('Selected: 2/2')).toBeInTheDocument();
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

    // Switch to Tholen system
    await user.selectOptions(screen.getByRole('combobox'), 'tholen');

    // Should call API with tholen system
    await waitFor(() => {
      expect(mockGetAsteroidsByClassification).toHaveBeenCalledWith('tholen');
    });
  });

  it('handles empty classification state', async () => {
    mockGetAsteroidsByClassification.mockResolvedValue({ classes: [] });
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No classifications found for the selected system.')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles empty asteroid list in classification', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    // Expand X classification (which has no asteroids)
    await user.click(screen.getByText('X'));

    expect(screen.getByText('No asteroids found in this classification.')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Network error';
    mockGetAsteroidsByClassification.mockRejectedValue(new Error(errorMessage));
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('displays correct asteroid names based on available data', async () => {
    const user = userEvent.setup();
    
    // Mock data with different name scenarios
    const mockDataWithNames = {
      classes: [
        {
          name: 'Test',
          asteroids: [
            {
              id: 1,
              proper_name: 'Named Asteroid',
              official_number: 123,
              bus_demeo_class: 'S',
            },
            {
              id: 2,
              official_number: 456,
              bus_demeo_class: 'S',
            },
            {
              id: 3,
              provisional_designation: '2023 AB1',
              bus_demeo_class: 'S',
            },
            {
              id: 4,
              bus_demeo_class: 'S',
            },
          ],
        },
      ],
    };

    mockGetAsteroidsByClassification.mockResolvedValue(mockDataWithNames);
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test'));

    await waitFor(() => {
      expect(screen.getByText('Named Asteroid')).toBeInTheDocument();
      expect(screen.getByText('(456)')).toBeInTheDocument();
      expect(screen.getByText('2023 AB1')).toBeInTheDocument();
      expect(screen.getByText('ID: 4')).toBeInTheDocument();
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

    // Focus on S classification header - get the specific classification header button
    const sHeaders = screen.getAllByRole('button');
    const sHeader = sHeaders.find(button => button.textContent?.includes('S') && button.textContent?.includes('(2)'));
    expect(sHeader).toBeDefined();
    sHeader!.focus();

    // Press Enter to expand
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Press Space to collapse
    await user.keyboard(' ');

    expect(screen.queryByText('Eros')).not.toBeInTheDocument();
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

    // Expand and select an asteroid
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    expect(screen.getByText('Selected: 1/10')).toBeInTheDocument();

    // Switch classification system
    await user.selectOptions(screen.getByRole('combobox'), 'tholen');

    // Selection should be maintained
    await waitFor(() => {
      expect(screen.getByText('Selected: 1/10')).toBeInTheDocument();
    });
  });

  it('shows bulk select button when classification is expanded', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Initially no bulk select button visible
    expect(screen.queryByText('Select All')).not.toBeInTheDocument();

    // Expand S classification
    await user.click(screen.getByText('S'));

    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Now bulk select button should be visible
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('handles bulk selection of classification', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification
    await user.click(screen.getByText('S'));

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Click bulk select
    await user.click(screen.getByText('Select All'));

    // Should select both asteroids in S classification
    expect(screen.getByText('Selected: 2/10')).toBeInTheDocument();
    
    // Both checkboxes should be checked
    expect(screen.getByRole('checkbox', { name: /Select Eros/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Select Itokawa/ })).toBeChecked();
  });

  it('disables bulk select when no more selections allowed', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification and select one asteroid
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));

    // Bulk select button should be disabled
    const bulkSelectBtn = screen.getByText('Select All');
    expect(bulkSelectBtn).toBeDisabled();
  });

  it('shows error when bulk select would exceed limit', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification
    await user.click(screen.getByText('S'));

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Try to bulk select when it would exceed limit
    await user.click(screen.getByText('Select All'));

    // Should show error message
    expect(screen.getByText('Cannot select 2 asteroids. Only 1 selections remaining.')).toBeInTheDocument();
  });

  it('disables asteroid checkboxes when selection limit reached', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={2} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification and select both asteroids
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    await user.click(screen.getByRole('checkbox', { name: /Select Itokawa/ }));

    // Expand C classification
    await user.click(screen.getByText('C'));
    
    await waitFor(() => {
      expect(screen.getByText('Ceres')).toBeInTheDocument();
    });

    // Ceres checkbox should be disabled
    const ceresCheckbox = screen.getByRole('checkbox', { name: /Select Ceres/ });
    expect(ceresCheckbox).toBeDisabled();
  });

  it('clears selection-related errors when clearing all selections', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree maxSelections={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Expand S classification first
    const sClassificationHeader = screen.getByText('S').closest('.classification-header');
    await user.click(sClassificationHeader!);
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    // Try to bulk select first to trigger error (before any individual selections)
    await user.click(screen.getByText('Select All'));
    
    // Should show error
    expect(screen.getByText('Cannot select 2 asteroids. Only 1 selections remaining.')).toBeInTheDocument();
    
    // Now select one asteroid manually to get clear all button
    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));
    
    // Clear all selections
    await user.click(screen.getByText('Clear All'));

    // Error should be cleared
    expect(screen.queryByText('Cannot select 2 asteroids. Only 1 selections remaining.')).not.toBeInTheDocument();
  });

  it('shows correct accessibility labels for bulk select button', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    await user.click(screen.getByText('S'));

    await waitFor(() => {
      const bulkSelectBtn = screen.getByRole('button', { name: /Select all asteroids in S classification/ });
      expect(bulkSelectBtn).toBeInTheDocument();
      expect(bulkSelectBtn).toHaveAttribute('title', 'Select all 2 asteroids in this classification');
    });
  });

  it('shows correct accessibility label for clear all button', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <TaxonomyTree />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    // Select an asteroid to show clear all button
    await user.click(screen.getByText('S'));
    
    await waitFor(() => {
      expect(screen.getByText('Eros')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /Select Eros/ }));

    // Check clear all button has correct accessibility label
    const clearAllBtn = screen.getByRole('button', { name: /Clear all selected asteroids/ });
    expect(clearAllBtn).toBeInTheDocument();
  });
});