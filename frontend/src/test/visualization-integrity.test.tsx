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
import { apiClient } from '../services/api';
import { generateLargeAsteroidDataset, generatePaginatedResponse } from './test-helpers/largeDataset';

// Mock D3 for spectral chart tests
const mockD3Selection: any = {
  selectAll: vi.fn(() => mockD3Selection),
  remove: vi.fn(() => mockD3Selection),
  append: vi.fn(() => mockD3Selection),
  attr: vi.fn(() => mockD3Selection),
  style: vi.fn(() => mockD3Selection),
  text: vi.fn(() => mockD3Selection),
  datum: vi.fn(() => mockD3Selection),
  data: vi.fn(() => mockD3Selection),
  enter: vi.fn(() => mockD3Selection),
  call: vi.fn(() => mockD3Selection),
  on: vi.fn(() => mockD3Selection),
  transition: vi.fn(() => mockD3Selection),
  duration: vi.fn(() => mockD3Selection),
  select: vi.fn(() => mockD3Selection),
  html: vi.fn(() => mockD3Selection),
  node: vi.fn(() => ({ getBoundingClientRect: () => ({ width: 800, height: 500 }) })),
};

const mockD3Scale: any = {
  domain: vi.fn(() => mockD3Scale),
  range: vi.fn(() => mockD3Scale),
  invert: vi.fn((x: number) => x * 0.001 + 0.5),
  rescaleX: vi.fn(() => mockD3Scale),
  rescaleY: vi.fn(() => mockD3Scale),
};

const mockD3Axis: any = {
  tickFormat: vi.fn(() => mockD3Axis),
  ticks: vi.fn(() => mockD3Axis),
  tickSize: vi.fn(() => mockD3Axis),
};

const mockD3Line: any = {
  x: vi.fn(() => mockD3Line),
  y: vi.fn(() => mockD3Line),
  curve: vi.fn(() => mockD3Line),
};

const mockD3Zoom: any = {
  scaleExtent: vi.fn(() => mockD3Zoom),
  extent: vi.fn(() => mockD3Zoom),
  on: vi.fn(() => mockD3Zoom),
  transform: vi.fn(),
};

vi.mock('d3', () => ({
  select: vi.fn(() => mockD3Selection),
  selectAll: vi.fn(() => mockD3Selection),
  scaleLinear: vi.fn(() => mockD3Scale),
  scaleOrdinal: vi.fn(() => vi.fn((i: string) => `color-${i}`)),
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
  extent: vi.fn(() => [0.5, 2.5]),
  line: vi.fn(() => mockD3Line),
  axisBottom: vi.fn(() => mockD3Axis),
  axisLeft: vi.fn(() => mockD3Axis),
  format: vi.fn(() => vi.fn((d: number) => d.toFixed(2))),
  curveLinear: 'curveLinear',
  zoom: vi.fn(() => mockD3Zoom),
  zoomIdentity: { k: 1, x: 0, y: 0 },
  zoomTransform: vi.fn(() => ({ k: 1, x: 0, y: 0, rescaleX: vi.fn(() => mockD3Scale), rescaleY: vi.fn(() => mockD3Scale) })),
  pointer: vi.fn(() => [400, 250]),
}));

// Mock API
vi.mock('../services/api', () => ({
  apiClient: {
    getAsteroidsByClassification: vi.fn(),
    getClassificationAsteroidsPage: vi.fn(),
    getClassificationMetadata: vi.fn(),
    getAsteroidSpectrum: vi.fn(),
    getAsteroidsSpectraBatch: vi.fn(),
    getAsteroid: vi.fn(),
    getSpectrum: vi.fn(),
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
  const mockApiClient = vi.mocked(apiClient);

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getClassificationMetadata.mockResolvedValue({
      system: 'bus_demeo',
      classes: [
        { name: 'C', total_count: 1000, spectral_count: 700, spectral_percentage: 70 },
        { name: 'S', total_count: 1000, spectral_count: 700, spectral_percentage: 70 },
        { name: 'X', total_count: 1000, spectral_count: 700, spectral_percentage: 70 },
      ],
      total_asteroids: 3000,
      total_with_spectra: 2100,
      overall_spectral_percentage: 70,
    } as any);
    mockApiClient.getAsteroid.mockImplementation(async (id: number) => ({
      asteroid: {
        id,
        proper_name: `Asteroid ${id}`,
        bus_demeo_class: 'C',
        has_spectral_data: true,
      },
    }) as any);
    mockApiClient.getSpectrum.mockImplementation(async (id: number) => ({
      spectrum: generateMockSpectralData(id),
    }) as any);
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
      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
          spectralData={selectedAsteroids.map(id => generateMockSpectralData(id))}
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
      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
          spectralData={[
            generateMockSpectralData(1, 100),
            generateMockSpectralData(2, 400),
            generateMockSpectralData(3, 800),
            generateMockSpectralData(4, 1200),
            generateMockSpectralData(5, 50),
          ]}
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
      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
          spectralData={[
            generateMockSpectralData(1),
            generateMockSpectralData(3),
          ]}
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

      const startTime = performance.now();
      
      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
          spectralData={selectedAsteroids.map(id => generateMockSpectralData(id, 600))}
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

      mockApiClient.getClassificationMetadata.mockResolvedValue({
        system: 'bus_demeo',
        classes: Object.entries(classificationGroups).map(([name, asteroids]) => ({
          name,
          total_count: asteroids.length,
          spectral_count: asteroids.length,
          spectral_percentage: 100,
        })),
        total_asteroids: largeDataset.length,
        total_with_spectra: largeDataset.length,
        overall_spectral_percentage: 100,
      } as any);
      mockApiClient.getClassificationAsteroidsPage.mockImplementation(async (_system, classificationName) => {
        const asteroids = classificationGroups[classificationName] ?? [];
        return generatePaginatedResponse(asteroids, 1, 100) as any;
      });

      const { container } = render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      const classificationWithCount = screen.getByText('C').closest('.classification-header');
      expect(classificationWithCount).toBeInTheDocument();
      expect(classificationWithCount).toHaveTextContent(/\(\d+\)/);

      // Expand large classification
      fireEvent.click(screen.getByText('C'));

      await waitFor(() => {
        const asteroidElements = container.querySelectorAll('.asteroid-item');
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

      mockApiClient.getClassificationMetadata.mockResolvedValue({
        system: 'bus_demeo',
        classes: mockClasses.map(({ name, asteroids }) => ({
          name,
          total_count: asteroids.length,
          spectral_count: asteroids.length,
          spectral_percentage: 100,
        })),
        total_asteroids: mockClasses.reduce((sum, cls) => sum + cls.asteroids.length, 0),
        total_with_spectra: mockClasses.reduce((sum, cls) => sum + cls.asteroids.length, 0),
        overall_spectral_percentage: 100,
      } as any);

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
        const classificationHeader = screen.getByText(cls).closest('.classification-header');
        expect(classificationHeader).toBeInTheDocument();
        expect(classificationHeader).toHaveTextContent(/\(\d+\)/);
      });
    });

    it('should maintain selection state with large datasets', async () => {
      const largeDataset = generateLargeAsteroidDataset(200);
      
      mockApiClient.getClassificationMetadata.mockResolvedValue({
        system: 'bus_demeo',
        classes: [{
          name: 'C',
          total_count: 200,
          spectral_count: 200,
          spectral_percentage: 100,
        }],
        total_asteroids: 200,
        total_with_spectra: 200,
        overall_spectral_percentage: 100,
      } as any);
      mockApiClient.getClassificationAsteroidsPage.mockResolvedValue(
        generatePaginatedResponse(largeDataset, 1, 100) as any
      );

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

      const { container } = render(
        <PropertiesPanel
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      // Should render properties panel
      expect(container.querySelector('.properties-panel')).toBeInTheDocument();

      // Should show some asteroid properties (may be paginated or virtualized)
      const comparedAsteroids = container.querySelectorAll('.comparison-col-button');
      expect(comparedAsteroids.length).toBe(selectedAsteroids.length);
      expect(screen.getByText('25 asteroids selected')).toBeInTheDocument();
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

      const { container } = render(
        <PropertiesPanel
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData as any}
        />
      );

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

      const startTime = performance.now();
      
      const { container } = render(
        <PropertiesPanel
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );
      
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
      
      mockApiClient.getClassificationMetadata.mockResolvedValue({
        system: 'bus_demeo',
        classes: [{
          name: 'C',
          total_count: 500,
          spectral_count: 500,
          spectral_percentage: 100,
        }],
        total_asteroids: 500,
        total_with_spectra: 500,
        overall_spectral_percentage: 100,
      } as any);
      mockApiClient.getClassificationAsteroidsPage.mockResolvedValue(
        generatePaginatedResponse(largeDataset, 1, 100) as any
      );

      mockApiClient.getAsteroidsSpectraBatch.mockResolvedValue({
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
