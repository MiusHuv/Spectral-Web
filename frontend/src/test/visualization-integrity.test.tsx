/**
 * Tests to ensure visualization components work correctly with large datasets
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { AppProvider } from '../context/AppContext';
import SpectralChart from '../components/spectral/SpectralChart';
import TaxonomyTree from '../components/taxonomy/TaxonomyTree';
import PropertiesPanel from '../components/properties/PropertiesPanel';
import { generateLargeAsteroidDataset } from './large-dataset.test';

// Mock D3 for spectral chart tests
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      data: vi.fn(() => ({
        enter: vi.fn(() => ({
          append: vi.fn(() => ({
            attr: vi.fn(() => ({ attr: vi.fn() })),
            style: vi.fn(() => ({ style: vi.fn() })),
          })),
        })),
        exit: vi.fn(() => ({ remove: vi.fn() })),
        attr: vi.fn(() => ({ attr: vi.fn() })),
        style: vi.fn(() => ({ style: vi.fn() })),
      })),
    })),
    append: vi.fn(() => ({
      attr: vi.fn(() => ({ attr: vi.fn() })),
      style: vi.fn(() => ({ style: vi.fn() })),
      call: vi.fn(),
    })),
    attr: vi.fn(() => ({ attr: vi.fn() })),
    style: vi.fn(() => ({ style: vi.fn() })),
    call: vi.fn(),
    node: vi.fn(() => ({ getBBox: () => ({ width: 100, height: 50 }) })),
  })),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn() })),
    range: vi.fn(() => ({ domain: vi.fn() })),
  })),
  line: vi.fn(() => ({
    x: vi.fn(() => ({ y: vi.fn() })),
    y: vi.fn(() => ({ x: vi.fn() })),
  })),
  axisBottom: vi.fn(),
  axisLeft: vi.fn(),
  extent: vi.fn(() => [0, 1]),
  max: vi.fn(() => 1),
  min: vi.fn(() => 0),
}));

// Mock API
vi.mock('../services/api', () => ({
  apiClient: {
    getAsteroidsByClassification: vi.fn(),
    getClassificationMetadata: vi.fn(),
    getAsteroidSpectrum: vi.fn(),
    getAsteroidsSpectraBatch: vi.fn(),
    getAsteroidsBatch: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}));

// Generate mock spectral data
const generateMockSpectralData = (asteroidId: number, points: number = 400) => ({
  asteroid_id: asteroidId,
  wavelengths: Array.from({ length: points }, (_, i) => 0.45 + i * 0.005),
  reflectances: Array.from({ length: points }, () => 0.5 + Math.random() * 0.3),
  normalized: true,
});

describe('Visualization Integrity with Large Datasets', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = require('../services/api');
    vi.clearAllMocks();
  });

  describe('SpectralChart with Large Selections', () => {
    it('should handle 50+ selected asteroids without breaking', async () => {
      const selectedAsteroids = Array.from({ length: 50 }, (_, i) => i + 1);
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Asteroid ${id}`,
          bus_demeo_class: ['C', 'S', 'X', 'M', 'P'][id % 5],
        };
        return acc;
      }, {} as any);

      // Mock spectral data for all asteroids
      mockApi.apiClient.getAsteroidsSpectraBatch.mockResolvedValue({
        spectra: selectedAsteroids.map(id => generateMockSpectralData(id)),
      });

      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      // Wait for chart to render
      await waitFor(() => {
        expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument();
      });

      // Should not crash with large number of spectra
      expect(container.querySelector('.spectral-chart-svg')).toBeInTheDocument();
      
      // Should show loading or error state appropriately
      const loadingElement = container.querySelector('.loading-spinner');
      const errorElement = container.querySelector('.error-message');
      const chartElement = container.querySelector('.spectral-chart-svg');
      
      expect(loadingElement || errorElement || chartElement).toBeInTheDocument();
    });

    it('should handle spectral data with varying point counts', async () => {
      const selectedAsteroids = [1, 2, 3, 4, 5];
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Asteroid ${id}`,
          bus_demeo_class: 'C',
        };
        return acc;
      }, {} as any);

      // Mock spectral data with different point counts
      mockApi.apiClient.getAsteroidsSpectraBatch.mockResolvedValue({
        spectra: [
          generateMockSpectralData(1, 100),   // Low resolution
          generateMockSpectralData(2, 400),   // Standard resolution
          generateMockSpectralData(3, 800),   // High resolution
          generateMockSpectralData(4, 1200),  // Very high resolution
          generateMockSpectralData(5, 50),    // Very low resolution
        ],
      });

      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument();
      });

      // Should handle varying data sizes without breaking
      expect(container.querySelector('.spectral-chart-svg')).toBeInTheDocument();
    });

    it('should handle missing spectral data gracefully', async () => {
      const selectedAsteroids = [1, 2, 3, 4, 5];
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Asteroid ${id}`,
          bus_demeo_class: 'C',
        };
        return acc;
      }, {} as any);

      // Mock partial spectral data (some asteroids missing)
      mockApi.apiClient.getAsteroidsSpectraBatch.mockResolvedValue({
        spectra: [
          generateMockSpectralData(1),
          generateMockSpectralData(3),
          // Missing data for asteroids 2, 4, 5
        ],
      });

      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument();
      });

      // Should show appropriate message for missing data
      const noDataMessage = screen.queryByText(/no spectral data/i) || 
                           screen.queryByText(/data unavailable/i) ||
                           container.querySelector('.no-data-message');
      
      // Either shows the chart with available data or shows no data message
      expect(
        container.querySelector('.spectral-chart-svg') || noDataMessage
      ).toBeInTheDocument();
    });

    it('should maintain performance with complex spectral overlays', async () => {
      const selectedAsteroids = Array.from({ length: 20 }, (_, i) => i + 1);
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Asteroid ${id}`,
          bus_demeo_class: ['C', 'S', 'X', 'M', 'P'][id % 5],
        };
        return acc;
      }, {} as any);

      mockApi.apiClient.getAsteroidsSpectraBatch.mockResolvedValue({
        spectra: selectedAsteroids.map(id => generateMockSpectralData(id, 600)),
      });

      const startTime = performance.now();
      
      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time even with many overlays
      expect(renderTime).toBeLessThan(2000); // 2 seconds max
    });
  });

  describe('TaxonomyTree with Large Classifications', () => {
    it('should handle classifications with 1000+ asteroids', async () => {
      const largeDataset = generateLargeAsteroidDataset(1000);
      
      // Group by classification
      const classificationGroups = largeDataset.reduce((acc, asteroid) => {
        const cls = asteroid.bus_demeo_class;
        if (!acc[cls]) acc[cls] = [];
        acc[cls].push(asteroid);
        return acc;
      }, {} as Record<string, any[]>);

      const mockClassifications = {
        classes: Object.entries(classificationGroups).map(([name, asteroids]) => ({
          name,
          asteroids: asteroids.slice(0, 100), // First page
          total_count: asteroids.length,
          has_more: asteroids.length > 100,
        })),
      };

      mockApi.apiClient.getAsteroidsByClassification.mockResolvedValue(mockClassifications);

      const { container } = render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Should show classification with count
      const classificationWithCount = screen.getByText(/C.*\(\d+\)/);
      expect(classificationWithCount).toBeInTheDocument();

      // Expand large classification
      fireEvent.click(screen.getByText('C'));

      await waitFor(() => {
        // Should show some asteroids (virtual scrolling may limit display)
        const asteroidElements = screen.getAllByText(/Asteroid \d+/);
        expect(asteroidElements.length).toBeGreaterThan(0);
        expect(asteroidElements.length).toBeLessThan(200); // Virtual scrolling should limit
      });
    });

    it('should handle multiple large classifications simultaneously', async () => {
      const classifications = ['C', 'S', 'X', 'M', 'P'];
      const mockClasses = classifications.map(name => ({
        name,
        asteroids: generateLargeAsteroidDataset(500).map(a => ({ ...a, bus_demeo_class: name })),
        total_count: 500,
      }));

      mockApi.apiClient.getAsteroidsByClassification.mockResolvedValue({
        classes: mockClasses,
      });

      const { container } = render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      // Wait for all classifications to load
      await waitFor(() => {
        classifications.forEach(cls => {
          expect(screen.getByText(cls)).toBeInTheDocument();
        });
      });

      // Should handle multiple large classifications without performance issues
      expect(container.querySelector('.taxonomy-tree')).toBeInTheDocument();
      
      // All classifications should be visible
      classifications.forEach(cls => {
        expect(screen.getByText(new RegExp(`${cls}.*\\(\\d+\\)`))).toBeInTheDocument();
      });
    });

    it('should maintain selection state with large datasets', async () => {
      const largeDataset = generateLargeAsteroidDataset(200);
      
      mockApi.apiClient.getAsteroidsByClassification.mockResolvedValue({
        classes: [{
          name: 'C',
          asteroids: largeDataset,
          total_count: 200,
        }],
      });

      render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Expand classification
      fireEvent.click(screen.getByText('C'));

      await waitFor(() => {
        const asteroidElements = screen.getAllByText(/Asteroid \d+/);
        expect(asteroidElements.length).toBeGreaterThan(0);
      });

      // Select multiple asteroids
      const checkboxes = screen.getAllByRole('checkbox');
      const selectableCheckboxes = checkboxes.slice(0, Math.min(10, checkboxes.length));
      
      selectableCheckboxes.forEach(checkbox => {
        fireEvent.click(checkbox);
      });

      // Should maintain selection state
      await waitFor(() => {
        const selectedCheckboxes = screen.getAllByRole('checkbox', { checked: true });
        expect(selectedCheckboxes.length).toBe(selectableCheckboxes.length);
      });
    });
  });

  describe('PropertiesPanel with Large Selections', () => {
    it('should display properties for 25+ selected asteroids', () => {
      const selectedAsteroids = Array.from({ length: 25 }, (_, i) => i + 1);
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Asteroid ${id}`,
          official_number: id,
          bus_demeo_class: ['C', 'S', 'X', 'M', 'P'][id % 5],
          tholen_class: ['C', 'S', 'M', 'E', 'P'][id % 5],
          orbital_elements: {
            semi_major_axis: 2.0 + Math.random() * 3.0,
            eccentricity: Math.random() * 0.3,
            inclination: Math.random() * 30,
            orbital_period: 3.0 + Math.random() * 5.0,
          },
          physical_properties: {
            diameter: Math.random() * 1000,
            albedo: Math.random() * 0.5,
            rotation_period: 5 + Math.random() * 20,
          },
        };
        return acc;
      }, {} as any);

      // Mock context state
      const mockState = {
        selectedAsteroids,
        asteroidData,
        loading: false,
        error: null,
      };

      vi.doMock('../context/AppContext', () => ({
        useAppContext: () => ({ state: mockState }),
      }));

      const { container } = render(<PropertiesPanel />);

      // Should render properties panel
      expect(container.querySelector('.properties-panel')).toBeInTheDocument();

      // Should show some asteroid properties (may be paginated or virtualized)
      const propertyElements = screen.getAllByText(/Asteroid \d+/);
      expect(propertyElements.length).toBeGreaterThan(0);
      expect(propertyElements.length).toBeLessThanOrEqual(25);
    });

    it('should handle missing property data gracefully', () => {
      const selectedAsteroids = [1, 2, 3, 4, 5];
      const asteroidData = {
        1: {
          id: 1,
          proper_name: 'Complete Asteroid',
          orbital_elements: { semi_major_axis: 2.5 },
          physical_properties: { diameter: 100 },
        },
        2: {
          id: 2,
          proper_name: 'Partial Asteroid',
          orbital_elements: {}, // Empty orbital elements
          physical_properties: null, // Null physical properties
        },
        3: {
          id: 3,
          proper_name: 'Minimal Asteroid',
          // Missing orbital_elements and physical_properties
        },
        4: {
          id: 4,
          proper_name: 'Asteroid with NaN',
          orbital_elements: { semi_major_axis: NaN },
          physical_properties: { diameter: null },
        },
        5: {
          id: 5,
          proper_name: 'Asteroid with Undefined',
          orbital_elements: { semi_major_axis: undefined },
          physical_properties: { diameter: undefined },
        },
      };

      const mockState = {
        selectedAsteroids,
        asteroidData,
        loading: false,
        error: null,
      };

      vi.doMock('../context/AppContext', () => ({
        useAppContext: () => ({ state: mockState }),
      }));

      const { container } = render(<PropertiesPanel />);

      // Should render without crashing
      expect(container.querySelector('.properties-panel')).toBeInTheDocument();

      // Should show N/A or placeholder for missing data
      const naElements = screen.getAllByText(/N\/A|--|-|Unknown/i);
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should maintain performance with complex property displays', () => {
      const selectedAsteroids = Array.from({ length: 50 }, (_, i) => i + 1);
      const asteroidData = selectedAsteroids.reduce((acc, id) => {
        acc[id] = {
          id,
          proper_name: `Very Long Asteroid Name ${id} with Extra Information`,
          official_number: id,
          provisional_designation: `2023 A${String(id).padStart(4, '0')}`,
          bus_demeo_class: ['C', 'S', 'X', 'M', 'P', 'D', 'T', 'B'][id % 8],
          tholen_class: ['C', 'S', 'M', 'E', 'P', 'F', 'G', 'B'][id % 8],
          orbital_class: ['MBA', 'NEA', 'Trojan', 'Centaur'][id % 4],
          orbital_elements: {
            semi_major_axis: 2.0 + Math.random() * 3.0,
            eccentricity: Math.random() * 0.3,
            inclination: Math.random() * 30,
            orbital_period: 3.0 + Math.random() * 5.0,
            perihelion_distance: 1.5 + Math.random() * 2.0,
            aphelion_distance: 3.0 + Math.random() * 4.0,
          },
          physical_properties: {
            diameter: Math.random() * 1000,
            albedo: Math.random() * 0.5,
            rotation_period: 5 + Math.random() * 20,
            density: 2.0 + Math.random() * 3.0,
          },
        };
        return acc;
      }, {} as any);

      const mockState = {
        selectedAsteroids,
        asteroidData,
        loading: false,
        error: null,
      };

      vi.doMock('../context/AppContext', () => ({
        useAppContext: () => ({ state: mockState }),
      }));

      const startTime = performance.now();
      
      const { container } = render(<PropertiesPanel />);
      
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second max

      // Should render properties panel
      expect(container.querySelector('.properties-panel')).toBeInTheDocument();
    });
  });

  describe('Cross-Component Integration', () => {
    it('should handle large dataset workflow without breaking', async () => {
      const largeDataset = generateLargeAsteroidDataset(500);
      
      mockApi.apiClient.getAsteroidsByClassification.mockResolvedValue({
        classes: [{
          name: 'C',
          asteroids: largeDataset.slice(0, 100),
          total_count: 500,
        }],
      });

      mockApi.apiClient.getAsteroidsBatch.mockResolvedValue({
        asteroids: largeDataset.slice(0, 10),
      });

      mockApi.apiClient.getAsteroidsSpectraBatch.mockResolvedValue({
        spectra: largeDataset.slice(0, 10).map(a => generateMockSpectralData(a.id)),
      });

      const { container } = render(
        <AppProvider>
          <div style={{ display: 'flex', height: '600px' }}>
            <div style={{ width: '300px' }}>
              <TaxonomyTree virtualScrollThreshold={50} />
            </div>
            <div style={{ flex: 1 }}>
              <SpectralChart
                selectedAsteroids={[1, 2, 3, 4, 5]}
                asteroidData={largeDataset.slice(0, 5).reduce((acc, a) => {
                  acc[a.id] = a;
                  return acc;
                }, {} as any)}
              />
            </div>
            <div style={{ width: '300px' }}>
              <PropertiesPanel />
            </div>
          </div>
        </AppProvider>
      );

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Should render all components without crashing
      expect(container.querySelector('.taxonomy-tree')).toBeInTheDocument();
      expect(container.querySelector('.spectral-chart-container')).toBeInTheDocument();
      expect(container.querySelector('.properties-panel')).toBeInTheDocument();
    });
  });
});

export { generateMockSpectralData };