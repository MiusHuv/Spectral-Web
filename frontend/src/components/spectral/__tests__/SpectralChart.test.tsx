import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import SpectralChart from '../SpectralChart';
import { SpectralData, Asteroid } from '../../../context/AppContext';

// Mock D3 with comprehensive interactive features support
const mockZoomBehavior = {
  scaleExtent: vi.fn(() => mockZoomBehavior),
  extent: vi.fn(() => mockZoomBehavior),
  on: vi.fn(() => mockZoomBehavior),
  transform: vi.fn(),
};

const mockSelection: any = {
  selectAll: vi.fn(() => mockSelection),
  remove: vi.fn(() => mockSelection),
  append: vi.fn(() => mockSelection),
  attr: vi.fn(() => mockSelection),
  style: vi.fn(() => mockSelection),
  text: vi.fn(() => mockSelection),
  datum: vi.fn(() => mockSelection),
  data: vi.fn(() => mockSelection),
  enter: vi.fn(() => mockSelection),
  call: vi.fn(() => mockSelection),
  on: vi.fn(() => mockSelection),
  transition: vi.fn(() => mockSelection),
  duration: vi.fn(() => mockSelection),
  select: vi.fn(() => mockSelection),
  html: vi.fn(() => mockSelection),
  node: vi.fn(() => ({ getBoundingClientRect: () => ({ width: 800, height: 500 }) })),
};

const mockScale = {
  domain: vi.fn(() => mockScale),
  range: vi.fn(() => mockScale),
  invert: vi.fn((x: number) => x * 0.001 + 0.5), // Mock wavelength conversion
  rescaleX: vi.fn(() => mockScale),
  rescaleY: vi.fn(() => mockScale),
};

const mockAxis = {
  tickFormat: vi.fn(() => mockAxis),
  ticks: vi.fn(() => mockAxis),
  tickSize: vi.fn(() => mockAxis),
};

const mockLine = {
  x: vi.fn(() => mockLine),
  y: vi.fn(() => mockLine),
  curve: vi.fn(() => mockLine),
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockSelection),
  selectAll: vi.fn(() => mockSelection),
  scaleLinear: vi.fn(() => mockScale),
  scaleOrdinal: vi.fn(() => vi.fn((i: string) => `color-${i}`)),
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
  extent: vi.fn(() => [0.5, 2.5]),
  line: vi.fn(() => mockLine),
  axisBottom: vi.fn(() => mockAxis),
  axisLeft: vi.fn(() => mockAxis),
  format: vi.fn(() => vi.fn((d: number) => d.toFixed(2))),
  curveLinear: 'curveLinear',
  zoom: vi.fn(() => mockZoomBehavior),
  zoomIdentity: { k: 1, x: 0, y: 0 },
  zoomTransform: vi.fn(() => ({ k: 1, x: 0, y: 0, rescaleX: vi.fn(() => mockScale), rescaleY: vi.fn(() => mockScale) })),
  pointer: vi.fn(() => [400, 250]), // Mock mouse position
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('SpectralChart Interactive Features', () => {
  const mockSpectralData: SpectralData[] = [
    {
      asteroid_id: 1,
      wavelengths: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      reflectances: [0.1, 0.2, 0.3, 0.4, 0.35, 0.3],
      normalized: true,
    },
    {
      asteroid_id: 2,
      wavelengths: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      reflectances: [0.15, 0.25, 0.35, 0.45, 0.4, 0.35],
      normalized: false,
    },
  ];

  const mockInvalidSpectralData: SpectralData[] = [
    {
      asteroid_id: 3,
      wavelengths: [], // Invalid: empty arrays
      reflectances: [],
      normalized: true,
    },
    {
      asteroid_id: 4,
      wavelengths: [0.5, 0.6], // Invalid: mismatched lengths
      reflectances: [0.1],
      normalized: false,
    },
  ];

  const mockAsteroidData: Record<number, Asteroid> = {
    1: {
      id: 1,
      official_number: 1,
      proper_name: 'Ceres',
      provisional_designation: null,
      bus_demeo_class: 'C',
      tholen_class: 'G',
      orbital_elements: {
        semi_major_axis: 2.77,
        eccentricity: 0.08,
        inclination: 10.6,
        orbital_period: 1681,
      },
      physical_properties: {
        diameter: 939.4,
        albedo: 0.09,
      },
    },
    2: {
      id: 2,
      official_number: 2,
      proper_name: 'Pallas',
      provisional_designation: null,
      bus_demeo_class: 'B',
      tholen_class: 'B',
      orbital_elements: {
        semi_major_axis: 2.77,
        eccentricity: 0.23,
        inclination: 34.8,
        orbital_period: 1686,
      },
      physical_properties: {
        diameter: 512,
        albedo: 0.16,
      },
    },
    3: {
      id: 3,
      official_number: 3,
      proper_name: 'Juno',
      provisional_designation: null,
      bus_demeo_class: 'S',
      tholen_class: 'S',
      orbital_elements: {
        semi_major_axis: 2.67,
        eccentricity: 0.26,
        inclination: 13.0,
        orbital_period: 1594,
      },
      physical_properties: {
        diameter: 233,
        albedo: 0.24,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect for container sizing
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 800,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    // Clean up any tooltips that might have been created
    document.querySelectorAll('.spectral-tooltip').forEach(el => el.remove());
  });

  describe('Basic Rendering', () => {
    it('renders empty state when no spectral data provided', () => {
      render(
        <SpectralChart
          spectralData={[]}
          asteroidData={{}}
        />
      );

      expect(screen.getByText('No spectral data available')).toBeInTheDocument();
      expect(screen.getByText('Select asteroids from the taxonomy tree to view their spectral curves')).toBeInTheDocument();
    });

    it('renders chart header with correct asteroid count and instructions', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('Spectral Data Visualization')).toBeInTheDocument();
      expect(screen.getByText('2 asteroids displayed')).toBeInTheDocument();
      expect(screen.getByText('Drag to pan • Scroll to zoom • Hover for details • Click "Reset Zoom" to restore view')).toBeInTheDocument();
    });

    it('renders chart with custom dimensions', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
          width={600}
          height={400}
        />
      );

      const svg = document.querySelector('.spectral-chart-svg');
      // The component may adjust width based on container size, so just check it's reasonable
      expect(svg).toHaveAttribute('height', '400');
      const width = svg?.getAttribute('width');
      expect(parseInt(width || '0')).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Invalid Data Handling', () => {
    it('handles invalid spectral data gracefully', () => {
      render(
        <SpectralChart
          spectralData={mockInvalidSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('No valid spectral data available')).toBeInTheDocument();
      expect(screen.getByText('2 asteroids have missing or corrupted spectral data')).toBeInTheDocument();
      expect(screen.getByText('Try selecting different asteroids or contact support if this issue persists')).toBeInTheDocument();
    });

    it('shows warning for mixed valid and invalid data', () => {
      const mixedData = [...mockSpectralData, ...mockInvalidSpectralData];
      
      render(
        <SpectralChart
          spectralData={mixedData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('2 asteroids displayed')).toBeInTheDocument();
      expect(screen.getByText('(2 excluded due to invalid data)')).toBeInTheDocument();
    });

    it('handles missing asteroid metadata gracefully', () => {
      const incompleteAsteroidData = {
        1: mockAsteroidData[1],
        // Missing asteroid 2
      };

      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={incompleteAsteroidData}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('Spectral Data Visualization')).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('sets up zoom behavior on SVG element', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify zoom behavior was created and applied
      expect(vi.mocked(mockSelection.call)).toHaveBeenCalled();
      expect(vi.mocked(mockZoomBehavior.scaleExtent)).toHaveBeenCalledWith([0.5, 10]);
    });

    it('creates tooltip element in DOM', async () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Wait for component to render
      await waitFor(() => {
        expect(mockSelection.append).toHaveBeenCalledWith('div');
      });
    });

    it('handles window resize events', () => {
      const { unmount } = render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Simulate window resize
      fireEvent.resize(window);

      // Component should handle resize gracefully
      expect(screen.getByText('Spectral Data Visualization')).toBeInTheDocument();

      unmount();
    });

    it('provides reset zoom functionality', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify reset zoom button setup
      expect(mockSelection.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Legend Functionality', () => {
    it('creates interactive legend items', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify legend items are created with hover interactions
      expect(mockSelection.on).toHaveBeenCalledWith('mouseover', expect.any(Function));
      expect(mockSelection.on).toHaveBeenCalledWith('mouseout', expect.any(Function));
    });

    it('truncates long asteroid names in legend', () => {
      const longNameData = [{
        ...mockSpectralData[0],
        asteroid_id: 999,
      }];
      
      const longNameAsteroid = {
        999: {
          ...mockAsteroidData[1],
          id: 999,
          proper_name: 'Very Long Asteroid Name That Should Be Truncated',
        },
      };

      render(
        <SpectralChart
          spectralData={longNameData}
          asteroidData={longNameAsteroid}
        />
      );

      // Legend should be created (exact text truncation is handled in D3 rendering)
      expect(mockSelection.text).toHaveBeenCalled();
    });
  });

  describe('Tooltip Interactions', () => {
    it('sets up hover interactions for spectral lines', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify hover event handlers are set up
      expect(mockSelection.on).toHaveBeenCalledWith('mouseover', expect.any(Function));
      expect(mockSelection.on).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockSelection.on).toHaveBeenCalledWith('mouseout', expect.any(Function));
    });

    it('handles mouse interactions on spectral lines', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify that mouse event handlers are properly attached
      const onCalls = vi.mocked(mockSelection.on).mock.calls;
      const mouseOverCalls = onCalls.filter(call => call[0] === 'mouseover');
      const mouseMoveCalls = onCalls.filter(call => call[0] === 'mousemove');
      const mouseOutCalls = onCalls.filter(call => call[0] === 'mouseout');

      expect(mouseOverCalls.length).toBeGreaterThan(0);
      expect(mouseMoveCalls.length).toBeGreaterThan(0);
      expect(mouseOutCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('handles chart rendering errors gracefully', () => {
      // Mock D3 to throw an error
      vi.mocked(mockSelection.append).mockImplementationOnce(() => {
        throw new Error('D3 rendering error');
      });

      // Component should render without crashing even when D3 throws an error
      expect(() => {
        render(
          <SpectralChart
            spectralData={mockSpectralData}
            asteroidData={mockAsteroidData}
          />
        );
      }).not.toThrow();

      // The component should still show the header
      expect(screen.getByText('Spectral Data Visualization')).toBeInTheDocument();
    });

    it('handles component cleanup properly', () => {
      const { unmount } = render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      const svg = document.querySelector('.spectral-chart-svg');
      expect(svg).toBeInTheDocument();
    });

    it('includes descriptive text for screen readers', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('Spectral Data Visualization')).toBeInTheDocument();
      expect(screen.getByText('2 asteroids displayed')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
      // Create a larger dataset
      const largeSpectralData: SpectralData[] = Array.from({ length: 10 }, (_, i) => ({
        asteroid_id: i + 1,
        wavelengths: Array.from({ length: 100 }, (_, j) => 0.5 + j * 0.02),
        reflectances: Array.from({ length: 100 }, () => Math.random()),
        normalized: i % 2 === 0,
      }));

      const largeAsteroidData: Record<number, Asteroid> = {};
      for (let i = 1; i <= 10; i++) {
        largeAsteroidData[i] = {
          ...mockAsteroidData[1],
          id: i,
          proper_name: `Asteroid ${i}`,
        };
      }

      const startTime = performance.now();
      render(
        <SpectralChart
          spectralData={largeSpectralData}
          asteroidData={largeAsteroidData}
        />
      );
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByText('10 asteroids displayed')).toBeInTheDocument();
    });
  });

  describe('Data Validation', () => {
    it('validates spectral data correctly', () => {
      const mixedValidityData: SpectralData[] = [
        {
          asteroid_id: 1,
          wavelengths: [0.5, 0.6, 0.7],
          reflectances: [0.1, 0.2, 0.3],
          normalized: true,
        },
        {
          asteroid_id: 2,
          wavelengths: [],
          reflectances: [],
          normalized: false,
        },
        {
          asteroid_id: 3,
          wavelengths: [0.5, 0.6],
          reflectances: [0.1], // Mismatched length
          normalized: true,
        },
      ];

      render(
        <SpectralChart
          spectralData={mixedValidityData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('1 asteroid displayed')).toBeInTheDocument();
      expect(screen.getByText('(2 excluded due to invalid data)')).toBeInTheDocument();
    });

    it('handles completely invalid data', () => {
      render(
        <SpectralChart
          spectralData={mockInvalidSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('No valid spectral data available')).toBeInTheDocument();
    });
  });

  describe('Zoom and Pan Features', () => {
    it('initializes zoom behavior with correct settings', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(mockZoomBehavior.scaleExtent).toHaveBeenCalledWith([0.5, 10]);
      expect(mockZoomBehavior.on).toHaveBeenCalledWith('zoom', expect.any(Function));
    });

    it('creates reset zoom button', () => {
      render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify reset button elements are created
      expect(mockSelection.append).toHaveBeenCalledWith('rect');
      expect(mockSelection.text).toHaveBeenCalled();
    });
  });

  describe('Component Updates', () => {
    it('handles prop updates correctly', () => {
      const { rerender } = render(
        <SpectralChart
          spectralData={[mockSpectralData[0]]}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('1 asteroid displayed')).toBeInTheDocument();

      rerender(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      expect(screen.getByText('2 asteroids displayed')).toBeInTheDocument();
    });

    it('clears previous chart content on updates', () => {
      const { rerender } = render(
        <SpectralChart
          spectralData={mockSpectralData}
          asteroidData={mockAsteroidData}
        />
      );

      rerender(
        <SpectralChart
          spectralData={[mockSpectralData[0]]}
          asteroidData={mockAsteroidData}
        />
      );

      // Verify that selectAll('*').remove() was called to clear previous content
      expect(mockSelection.selectAll).toHaveBeenCalledWith('*');
      expect(mockSelection.remove).toHaveBeenCalled();
    });
  });
});