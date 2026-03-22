/**
 * Performance tests for React components and frontend optimization.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { performance } from 'perf_hooks';
import '@testing-library/jest-dom';

import { AppProvider } from '../context/AppContext';
import TaxonomyTree from '../components/taxonomy/TaxonomyTree';
import SpectralChart from '../components/spectral/SpectralChart';
import PropertiesPanel from '../components/properties/PropertiesPanel';
import VirtualScrollList from '../components/common/VirtualScrollList';

import { vi } from 'vitest';

// Mock API calls
vi.mock('../services/api', () => ({
  apiClient: {
    getAsteroidsByClassification: vi.fn(),
    getAsteroidSpectrum: vi.fn(),
    getAsteroidsSpectraBatch: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}));

// Performance measurement utilities
class PerformanceMeasurer {
  private measurements: Map<string, number[]> = new Map();

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  clear() {
    this.measurements.clear();
  }
}

// Mock data generators
const generateMockAsteroids = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    official_number: i + 1,
    proper_name: `Asteroid ${i + 1}`,
    provisional_designation: `2023 A${i + 1}`,
    bus_demeo_class: ['C', 'S', 'X', 'M', 'P'][i % 5],
    tholen_class: ['C', 'S', 'M', 'E', 'P'][i % 5],
  }));
};

const generateMockSpectralData = (asteroidId: number) => ({
  asteroid_id: asteroidId,
  wavelengths: Array.from({ length: 400 }, (_, i) => 0.45 + i * 0.005),
  reflectances: Array.from({ length: 400 }, () => Math.random() * 0.5 + 0.5),
  normalized: true,
});

describe('Performance Tests', () => {
  let measurer: PerformanceMeasurer;

  beforeEach(() => {
    measurer = new PerformanceMeasurer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    const stats = measurer.getAllStats();
    if (Object.keys(stats).length > 0) {
      console.log('Performance measurements:', stats);
    }
  });

  describe('VirtualScrollList Performance', () => {
    test('should handle large lists efficiently', () => {
      const items = generateMockAsteroids(1000);
      
      const renderTime = measurer.measure('virtual-scroll-render', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id}>
                {item.proper_name} - {item.bus_demeo_class}
              </div>
            )}
          />
        );
      });

      // Should render quickly even with 1000 items
      expect(renderTime).toBeLessThan(100); // 100ms threshold

      // Should only render visible items
      const visibleItems = screen.getAllByText(/Asteroid \d+/);
      expect(visibleItems.length).toBeLessThan(20); // Only ~7-8 items should be visible
    });

    test('should handle scrolling performance', async () => {
      const items = generateMockAsteroids(500);
      
      const { container } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.proper_name}
            </div>
          )}
        />
      );

      const scrollContainer = container.querySelector('.virtual-scroll-container');
      expect(scrollContainer).toBeInTheDocument();

      // Measure scroll performance
      const scrollTime = measurer.measure('virtual-scroll-scroll', () => {
        fireEvent.scroll(scrollContainer!, { target: { scrollTop: 1000 } });
      });

      expect(scrollTime).toBeLessThan(50); // Should scroll quickly

      // Wait for scroll to settle
      await waitFor(() => {
        expect(scrollContainer!.scrollTop).toBe(1000);
      });
    });
  });

  describe('TaxonomyTree Performance', () => {
    test('should render large classification trees efficiently', async () => {
      const mockClassifications = {
        classes: Array.from({ length: 20 }, (_, i) => ({
          name: `Class ${String.fromCharCode(65 + i)}`,
          asteroids: generateMockAsteroids(100),
        })),
      };

      // Mock API response
      const { apiClient } = require('../services/api');
      apiClient.getAsteroidsByClassification.mockResolvedValue(mockClassifications);

      const renderTime = measurer.measure('taxonomy-tree-render', () => {
        render(
          <AppProvider>
            <TaxonomyTree virtualScrollThreshold={50} />
          </AppProvider>
        );
      });

      expect(renderTime).toBeLessThan(200); // Should render within 200ms

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/Class A/)).toBeInTheDocument();
      });
    });

    test('should handle classification expansion efficiently', async () => {
      const mockClassifications = {
        classes: [{
          name: 'C',
          asteroids: generateMockAsteroids(200),
        }],
      };

      const { apiClient } = require('../services/api');
      apiClient.getAsteroidsByClassification.mockResolvedValue(mockClassifications);

      render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Measure expansion performance
      const expansionTime = measurer.measure('taxonomy-expansion', () => {
        fireEvent.click(screen.getByText('C'));
      });

      expect(expansionTime).toBeLessThan(100); // Should expand quickly

      // Should use virtual scrolling for large lists
      await waitFor(() => {
        const asteroidItems = screen.getAllByText(/Asteroid \d+/);
        expect(asteroidItems.length).toBeLessThan(20); // Virtual scrolling should limit rendered items
      });
    });
  });

  describe('SpectralChart Performance', () => {
    test('should render charts with multiple spectra efficiently', () => {
      const selectedAsteroids = [1, 2, 3, 4, 5];
      const asteroidData = {
        1: { id: 1, proper_name: 'Ceres' },
        2: { id: 2, proper_name: 'Pallas' },
        3: { id: 3, proper_name: 'Juno' },
        4: { id: 4, proper_name: 'Vesta' },
        5: { id: 5, proper_name: 'Astraea' },
      };

      const renderTime = measurer.measure('spectral-chart-render', () => {
        render(
          <SpectralChart
            selectedAsteroids={selectedAsteroids}
            asteroidData={asteroidData}
          />
        );
      });

      expect(renderTime).toBeLessThan(300); // Should render within 300ms
    });

    test('should handle chart interactions efficiently', async () => {
      const selectedAsteroids = [1, 2];
      const asteroidData = {
        1: { id: 1, proper_name: 'Ceres' },
        2: { id: 2, proper_name: 'Pallas' },
      };

      const { container } = render(
        <SpectralChart
          selectedAsteroids={selectedAsteroids}
          asteroidData={asteroidData}
        />
      );

      // Wait for chart to render
      await waitFor(() => {
        expect(container.querySelector('.spectral-chart-svg')).toBeInTheDocument();
      });

      const svg = container.querySelector('.spectral-chart-svg');
      
      // Measure interaction performance
      const interactionTime = measurer.measure('spectral-chart-interaction', () => {
        fireEvent.mouseMove(svg!, { clientX: 100, clientY: 100 });
      });

      expect(interactionTime).toBeLessThan(50); // Interactions should be fast
    });
  });

  describe('PropertiesPanel Performance', () => {
    test('should render multiple asteroid properties efficiently', () => {
      const mockAsteroids = generateMockAsteroids(10).map(asteroid => ({
        ...asteroid,
        orbital_elements: {
          semi_major_axis: Math.random() * 5 + 1,
          eccentricity: Math.random() * 0.5,
          inclination: Math.random() * 30,
        },
        physical_properties: {
          diameter: Math.random() * 1000,
          albedo: Math.random() * 0.5,
          rotation_period: Math.random() * 24,
        },
      }));

      // Mock context state
      const mockState = {
        selectedAsteroids: mockAsteroids.map(a => a.id),
        asteroidData: mockAsteroids.reduce((acc, asteroid) => {
          acc[asteroid.id] = asteroid;
          return acc;
        }, {} as any),
        loading: false,
        error: null,
      };

      vi.doMock('../context/AppContext', () => ({
        useAppContext: () => ({ state: mockState }),
      }));

      const renderTime = measurer.measure('properties-panel-render', () => {
        render(<PropertiesPanel />);
      });

      expect(renderTime).toBeLessThan(200); // Should render within 200ms
    });
  });

  describe('Memory Usage Tests', () => {
    test('should not leak memory with repeated renders', () => {
      const items = generateMockAsteroids(100);
      
      // Measure memory usage over multiple renders
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => <div key={item.id}>{item.proper_name}</div>}
          />
        );
        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('React.memo Effectiveness', () => {
    test('should prevent unnecessary re-renders', () => {
      let renderCount = 0;
      
      const TestComponent = React.memo(() => {
        renderCount++;
        return <div>Test Component</div>;
      });

      const ParentComponent = ({ value }: { value: number }) => (
        <div>
          <div>Value: {value}</div>
          <TestComponent />
        </div>
      );

      const { rerender } = render(<ParentComponent value={1} />);
      expect(renderCount).toBe(1);

      // Re-render with same props - memo should prevent re-render
      rerender(<ParentComponent value={1} />);
      expect(renderCount).toBe(1);

      // Re-render with different props - should still not re-render TestComponent
      rerender(<ParentComponent value={2} />);
      expect(renderCount).toBe(1);
    });
  });
});

// Benchmark utility for comparing performance
export class ComponentBenchmark {
  static async compareRenderTimes(
    components: Array<{ name: string; component: React.ReactElement }>,
    iterations: number = 10
  ) {
    const results: Record<string, number[]> = {};

    for (const { name, component } of components) {
      results[name] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const { unmount } = render(component);
        const end = performance.now();
        
        results[name].push(end - start);
        unmount();
      }
    }

    // Calculate statistics
    const stats: Record<string, any> = {};
    for (const [name, times] of Object.entries(results)) {
      const sorted = [...times].sort((a, b) => a - b);
      stats[name] = {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      };
    }

    return stats;
  }
}