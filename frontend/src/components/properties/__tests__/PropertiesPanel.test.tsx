import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PropertiesPanel from '../PropertiesPanel';
import { AppProvider } from '../../../context/AppContext';
import type { Asteroid } from '../../../context/AppContext';

// Mock data for testing
const mockAsteroid1: Asteroid = {
  id: 1,
  official_number: 1,
  proper_name: 'Ceres',
  provisional_designation: '1801 GP',
  bus_demeo_class: 'C',
  tholen_class: 'G',
  orbital_elements: {
    semi_major_axis: 2.767,
    eccentricity: 0.0758,
    inclination: 10.593,
    orbital_period: 4.60,
    perihelion_distance: 2.558,
    aphelion_distance: 2.976,
  },
  physical_properties: {
    diameter: 939.4,
    albedo: 0.090,
    rotation_period: 9.074,
    density: 2.16,
  },
};

const mockAsteroid2: Asteroid = {
  id: 2,
  official_number: 2,
  proper_name: 'Pallas',
  provisional_designation: '1802 FA',
  bus_demeo_class: 'B',
  tholen_class: 'B',
  orbital_elements: {
    semi_major_axis: 2.773,
    eccentricity: 0.2313,
    inclination: 34.837,
    orbital_period: 4.62,
  },
  physical_properties: {
    diameter: 512.0,
    albedo: 0.159,
    rotation_period: 7.813,
  },
};

const mockAsteroidIncomplete: Asteroid = {
  id: 3,
  official_number: 3,
  proper_name: 'Juno',
  bus_demeo_class: 'S',
  // Missing many properties to test N/A handling
};

// Helper function to render component with context
const renderWithContext = (
  component: React.ReactElement,
  initialState?: Partial<any>
) => {
  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AppProvider>{children}</AppProvider>
  );

  return render(component, { wrapper: TestWrapper });
};

// Mock the context hook to control state
const mockUseAppContext = vi.fn();
vi.mock('../../../context/AppContext', async () => {
  const actual = await vi.importActual('../../../context/AppContext');
  return {
    ...actual,
    useAppContext: () => mockUseAppContext(),
  };
});

describe('PropertiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty States', () => {
    it('displays loading state when loading is true', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: true,
          error: null,
          selectedAsteroids: [],
          asteroidData: {},
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('Loading asteroid properties...')).toBeInTheDocument();
    });

    it('displays error state when error exists', () => {
      const errorMessage = 'Failed to load data';
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: errorMessage,
          selectedAsteroids: [],
          asteroidData: {},
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('displays no selection message when no asteroids are selected', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [],
          asteroidData: {},
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('No Asteroids Selected')).toBeInTheDocument();
      expect(screen.getByText('Select asteroids from the classification tree to view their properties.')).toBeInTheDocument();
    });

    it('displays loading data message when asteroids are selected but data is not loaded', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1, 2],
          asteroidData: {}, // No data loaded yet
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('Loading Asteroid Data')).toBeInTheDocument();
      expect(screen.getByText('Asteroid property data is being loaded...')).toBeInTheDocument();
    });
  });

  describe('Single Asteroid View', () => {
    beforeEach(() => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: mockAsteroid1,
          },
        },
      });
    });

    it('displays single asteroid in tabular layout', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Asteroid Properties')).toBeInTheDocument();
      expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
    });

    it('displays all identification information', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Identification')).toBeInTheDocument();
      expect(screen.getByText('Official Number:')).toBeInTheDocument();
      expect(screen.getByText('1.000')).toBeInTheDocument(); // Formatted number
      expect(screen.getByText('Proper Name:')).toBeInTheDocument();
      expect(screen.getByText('Provisional Designation:')).toBeInTheDocument();
      expect(screen.getByText('1801 GP')).toBeInTheDocument();
    });

    it('displays classification information', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Classification')).toBeInTheDocument();
      expect(screen.getByText('Bus-DeMeo Class:')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('Tholen Class:')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('displays orbital elements with proper units', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Orbital Elements')).toBeInTheDocument();
      expect(screen.getByText('Semi-major Axis:')).toBeInTheDocument();
      expect(screen.getByText('2.767')).toBeInTheDocument();
      const auElements = screen.getAllByText('AU');
      expect(auElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Eccentricity:')).toBeInTheDocument();
      expect(screen.getByText('0.075800')).toBeInTheDocument(); // Actual formatted number
      expect(screen.getByText('Inclination:')).toBeInTheDocument();
      expect(screen.getByText('10.593')).toBeInTheDocument();
      expect(screen.getByText('°')).toBeInTheDocument();
    });

    it('displays physical properties with proper units', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Physical Properties')).toBeInTheDocument();
      expect(screen.getByText('Diameter:')).toBeInTheDocument();
      expect(screen.getByText('939.400')).toBeInTheDocument(); // Formatted number
      expect(screen.getByText('km')).toBeInTheDocument();
      expect(screen.getByText('Albedo:')).toBeInTheDocument();
      expect(screen.getByText('0.090000')).toBeInTheDocument(); // Actual formatted number
      expect(screen.getByText('Rotation Period:')).toBeInTheDocument();
      expect(screen.getByText('9.074')).toBeInTheDocument();
      expect(screen.getByText('hours')).toBeInTheDocument();
    });

    it('handles missing data with N/A placeholders', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [3],
          asteroidData: {
            3: mockAsteroidIncomplete,
          },
        },
      });

      render(<PropertiesPanel />);
      
      // Should show N/A for missing properties
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Asteroids View', () => {
    beforeEach(() => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1, 2],
          asteroidData: {
            1: mockAsteroid1,
            2: mockAsteroid2,
          },
        },
      });
    });

    it('displays multiple asteroids in card-based layout', () => {
      render(<PropertiesPanel />);
      
      expect(screen.getByText('Asteroid Properties')).toBeInTheDocument();
      expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();
      
      // Both asteroids should be displayed as headings
      expect(screen.getByRole('heading', { level: 4, name: 'Ceres' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Pallas' })).toBeInTheDocument();
      
      // Both should have their IDs
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
      expect(screen.getByText('ID: 2')).toBeInTheDocument();
    });

    it('displays comparison data for multiple asteroids', () => {
      render(<PropertiesPanel />);
      
      // Should show both asteroids' data - use getAllByText for multiple occurrences
      const cClassifications = screen.getAllByText('C');
      expect(cClassifications.length).toBeGreaterThan(0); // Ceres Bus-DeMeo class
      const bClassifications = screen.getAllByText('B');
      expect(bClassifications.length).toBeGreaterThan(0); // Pallas Bus-DeMeo class
      
      // Should show different diameter values
      expect(screen.getByText('939.400')).toBeInTheDocument(); // Ceres diameter
      expect(screen.getByText('512.000')).toBeInTheDocument(); // Pallas diameter
    });

    it('handles mixed complete and incomplete data', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1, 3],
          asteroidData: {
            1: mockAsteroid1,
            3: mockAsteroidIncomplete,
          },
        },
      });

      render(<PropertiesPanel />);
      
      // Should show both asteroids - use getAllByText for multiple occurrences
      const ceresElements = screen.getAllByText('Ceres');
      expect(ceresElements.length).toBeGreaterThan(0);
      const junoElements = screen.getAllByText('Juno');
      expect(junoElements.length).toBeGreaterThan(0);
      
      // Should show N/A for missing data in Juno
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe('Layout Switching', () => {
    it('switches from single to multiple view when selection changes', async () => {
      // Start with single asteroid
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: mockAsteroid1,
          },
        },
      });

      const { rerender } = render(<PropertiesPanel />);
      
      expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();
      
      // Switch to multiple asteroids
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1, 2],
          asteroidData: {
            1: mockAsteroid1,
            2: mockAsteroid2,
          },
        },
      });

      rerender(<PropertiesPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();
      });
    });

    it('switches from multiple to single view when selection changes', async () => {
      // Start with multiple asteroids
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1, 2],
          asteroidData: {
            1: mockAsteroid1,
            2: mockAsteroid2,
          },
        },
      });

      const { rerender } = render(<PropertiesPanel />);
      
      expect(screen.getByText('2 asteroids selected')).toBeInTheDocument();
      
      // Switch to single asteroid
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: mockAsteroid1,
          },
        },
      });

      rerender(<PropertiesPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('1 asteroid selected')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: mockAsteroid1,
          },
        },
      });
    });

    it('has proper heading hierarchy', () => {
      render(<PropertiesPanel />);
      
      const h3 = screen.getByRole('heading', { level: 3, name: 'Asteroid Properties' });
      expect(h3).toBeInTheDocument();
      
      const h4 = screen.getByRole('heading', { level: 4, name: 'Ceres' });
      expect(h4).toBeInTheDocument();
      
      const h5Elements = screen.getAllByRole('heading', { level: 5 });
      expect(h5Elements.length).toBeGreaterThan(0);
    });

    it('applies custom className prop', () => {
      const { container } = render(<PropertiesPanel className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('properties-panel');
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Number Formatting', () => {
    it('formats large numbers with locale formatting', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: {
              ...mockAsteroid1,
              physical_properties: {
                ...mockAsteroid1.physical_properties,
                diameter: 1234.567,
              },
            },
          },
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('1,234.57')).toBeInTheDocument();
    });

    it('formats small numbers with appropriate precision', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: {
              ...mockAsteroid1,
              physical_properties: {
                ...mockAsteroid1.physical_properties,
                albedo: 0.000123,
              },
            },
          },
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('1.230e-4')).toBeInTheDocument();
    });

    it('handles zero values correctly', () => {
      mockUseAppContext.mockReturnValue({
        state: {
          loading: false,
          error: null,
          selectedAsteroids: [1],
          asteroidData: {
            1: {
              ...mockAsteroid1,
              orbital_elements: {
                ...mockAsteroid1.orbital_elements,
                eccentricity: 0,
              },
            },
          },
        },
      });

      render(<PropertiesPanel />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});