/**
 * Comprehensive tests for large dataset handling in frontend components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { AppProvider } from '../context/AppContext';
import TaxonomyTree from '../components/taxonomy/TaxonomyTree';
import VirtualScrollList from '../components/common/VirtualScrollList';
import { usePaginatedAsteroids } from '../hooks/usePaginatedAsteroids';
import { usePaginationCache } from '../hooks/usePaginationCache';
import { apiClient } from '../services/api';
import { renderHook, act as hookAct } from '@testing-library/react';
import {
  TestPerformanceMeasurer,
  generateLargeAsteroidDataset,
  generatePaginatedResponse,
} from './test-helpers/largeDataset';

// Mock API
vi.mock('../services/api', () => ({
  apiClient: {
    getAsteroidsByClassification: vi.fn(),
    getClassificationAsteroidsPage: vi.fn(),
    getClassificationMetadata: vi.fn(),
    getAsteroidSpectrum: vi.fn(),
  },
  apiUtils: {
    withRetry: vi.fn((fn) => fn()),
    getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
  },
}));


describe('Large Dataset Frontend Tests', () => {
  let measurer: TestPerformanceMeasurer;

  beforeEach(() => {
    measurer = new TestPerformanceMeasurer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear measurements for next test
    measurer.clear();
  });

  describe('Pagination Logic Tests', () => {
    it('should handle pagination with 5000+ asteroids efficiently', async () => {
      const largeDataset = generateLargeAsteroidDataset(5000);
      const cClassAsteroids = largeDataset.filter((asteroid) => asteroid.bus_demeo_class === 'C');
      const pageSize = 100;

      // Mock API responses for pagination
      vi.mocked(apiClient.getClassificationMetadata).mockResolvedValue({
        system: 'bus_demeo',
        classes: [
          { name: 'C', total_count: 2000, spectral_count: 1400, spectral_percentage: 70 },
          { name: 'S', total_count: 1500, spectral_count: 1050, spectral_percentage: 70 },
          { name: 'X', total_count: 1000, spectral_count: 700, spectral_percentage: 70 },
          { name: 'M', total_count: 500, spectral_count: 350, spectral_percentage: 70 },
        ],
        total_asteroids: 5000,
        total_with_spectra: 3500,
        overall_spectral_percentage: 70,
      });

      const { result } = renderHook(() => usePaginatedAsteroids('bus_demeo', 'C'));

      // Test loading first page
      const loadTime = await measurer.measureAsync('load-first-page', async () => {
        vi.mocked(apiClient.getClassificationAsteroidsPage).mockResolvedValueOnce(
          generatePaginatedResponse(cClassAsteroids, 1, pageSize)
        );

        await hookAct(async () => {
          await result.current.loadPage(1);
        });
      });

      expect(loadTime).toBeLessThan(500); // Should load within 500ms
      expect(result.current.data?.asteroids).toHaveLength(pageSize);
      expect(result.current.data?.pagination.total).toBe(cClassAsteroids.length);
      expect(result.current.data?.pagination.hasMore).toBe(true);
    });

    it('should cache pagination results efficiently', async () => {
      const { result } = renderHook(() => usePaginationCache());

      const testData = generatePaginatedResponse(generateLargeAsteroidDataset(1000), 1, 100);

      // Measure cache operations
      const setCacheTime = measurer.measure('cache-set', () => {
        hookAct(() => {
          result.current.set('test-key', testData);
        });
      });

      const getCacheTime = measurer.measure('cache-get', () => {
        return result.current.get('test-key');
      });

      expect(setCacheTime).toBeLessThan(10); // Cache set should be very fast
      expect(getCacheTime).toBeLessThan(5); // Cache get should be very fast
      expect(result.current.get('test-key')).toEqual(testData);
    });

    it('should handle cache eviction with large datasets', () => {
      const { result } = renderHook(() => 
        usePaginationCache({ maxCacheSize: 5, enableLRU: true })
      );

      // Fill cache beyond capacity
      hookAct(() => {
        for (let i = 0; i < 10; i++) {
          const data = generatePaginatedResponse(generateLargeAsteroidDataset(100), i + 1, 100);
          result.current.set(`page-${i}`, data);
        }
      });

      // Should only have 5 items (maxCacheSize)
      expect(result.current.size()).toBe(5);

      // Oldest items should be evicted
      expect(result.current.get('page-0')).toBeNull();
      expect(result.current.get('page-1')).toBeNull();
      expect(result.current.get('page-9')).not.toBeNull();
    });

    it('should handle concurrent pagination requests', async () => {
      const { result } = renderHook(() => usePaginatedAsteroids('bus_demeo', 'C'));

      // Mock multiple page responses
      const pages = [1, 2, 3, 4, 5];
      const responses = pages.map(page => 
        generatePaginatedResponse(generateLargeAsteroidDataset(1000), page, 100)
      );

      vi.mocked(apiClient.getClassificationAsteroidsPage)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2])
        .mockResolvedValueOnce(responses[3])
        .mockResolvedValueOnce(responses[4]);

      // Load multiple pages concurrently
      const concurrentLoadTime = await measurer.measureAsync('concurrent-load', async () => {
        await hookAct(async () => {
          const promises = pages.map(page => result.current.loadPage(page));
          await Promise.all(promises);
        });
      });

      expect(concurrentLoadTime).toBeLessThan(1000); // Should handle concurrent loads efficiently
    });
  });

  describe('Virtual Scrolling Performance Tests', () => {
    it('should render large lists efficiently with virtual scrolling', () => {
      const items = generateLargeAsteroidDataset(10000);

      const renderTime = measurer.measure('virtual-scroll-large-render', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id} data-testid={`asteroid-${item.id}`}>
                {item.proper_name} - {item.bus_demeo_class}
              </div>
            )}
          />
        );
      });

      expect(renderTime).toBeLessThan(200); // Should render quickly even with 10k items

      // Should only render visible items
      const visibleItems = screen.getAllByTestId(/asteroid-\d+/);
      expect(visibleItems.length).toBeLessThan(20); // Only visible items should be rendered
    });

    it('should handle scrolling through large datasets smoothly', async () => {
      const items = generateLargeAsteroidDataset(5000);

      const { container } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id} data-testid={`asteroid-${item.id}`}>
              {item.proper_name}
            </div>
          )}
        />
      );

      const scrollContainer = container.querySelector('.virtual-scroll-container');
      expect(scrollContainer).toBeInTheDocument();

      // Test scrolling performance
      const scrollPositions = [500, 1000, 2000, 5000, 10000];
      
      for (const position of scrollPositions) {
        const scrollTime = measurer.measure(`scroll-to-${position}`, () => {
          fireEvent.scroll(scrollContainer!, { target: { scrollTop: position } });
        });

        expect(scrollTime).toBeLessThan(50); // Each scroll should be fast

        await waitFor(() => {
          expect(scrollContainer!.scrollTop).toBe(position);
        });
      }
    });

    it('should handle load more functionality with large datasets', async () => {
      const totalItems = 10000;
      const pageSize = 100;
      let currentPage = 1;
      let loadedItems = generateLargeAsteroidDataset(pageSize);

      const mockLoadMore = vi.fn(() => {
        currentPage++;
        const newItems = generateLargeAsteroidDataset(pageSize).map(item => ({
          ...item,
          id: item.id + (currentPage - 1) * pageSize,
        }));
        loadedItems = [...loadedItems, ...newItems];
      });

      const { container, rerender } = render(
        <VirtualScrollList
          items={loadedItems}
          itemHeight={60}
          containerHeight={400}
          hasMore={loadedItems.length < totalItems}
          onLoadMore={mockLoadMore}
          renderItem={(item) => (
            <div key={item.id}>{item.proper_name}</div>
          )}
        />
      );

      // Scroll to bottom to trigger load more
      const scrollContainer = container.querySelector('.virtual-scroll-container');
      expect(scrollContainer).toBeInTheDocument();
      
      const loadMoreTime = measurer.measure('load-more-trigger', () => {
        fireEvent.scroll(scrollContainer!, {
          target: { 
            scrollTop: scrollContainer!.scrollHeight - scrollContainer!.clientHeight - 50
          } 
        });
      });

      expect(loadMoreTime).toBeLessThan(100);

      await waitFor(() => {
        expect(mockLoadMore).toHaveBeenCalled();
      });

      // Re-render with new items
      rerender(
        <VirtualScrollList
          items={loadedItems}
          itemHeight={60}
          containerHeight={400}
          hasMore={loadedItems.length < totalItems}
          onLoadMore={mockLoadMore}
          renderItem={(item) => (
            <div key={item.id}>{item.proper_name}</div>
          )}
        />
      );

      expect(loadedItems.length).toBe(pageSize * 2);
    });
  });

  describe('TaxonomyTree Large Dataset Tests', () => {
    it('should handle classification trees with 5000+ asteroids', async () => {
      const largeDataset = generateLargeAsteroidDataset(5000);
      
      // Group by classification
      const classificationGroups = largeDataset.reduce((acc, asteroid) => {
        const cls = asteroid.bus_demeo_class;
        if (!acc[cls]) acc[cls] = [];
        acc[cls].push(asteroid);
        return acc;
      }, {} as Record<string, any[]>);

      vi.mocked(apiClient.getClassificationMetadata).mockResolvedValue({
        system: 'bus_demeo',
        classes: Object.entries(classificationGroups).map(([name, asteroids]) => ({
          name,
          total_count: asteroids.length,
          spectral_count: asteroids.filter((asteroid) => asteroid.has_spectral_data).length,
          spectral_percentage:
            asteroids.length > 0
              ? (asteroids.filter((asteroid) => asteroid.has_spectral_data).length / asteroids.length) * 100
              : 0,
        })),
        total_asteroids: largeDataset.length,
        total_with_spectra: largeDataset.filter((asteroid) => asteroid.has_spectral_data).length,
        overall_spectral_percentage:
          (largeDataset.filter((asteroid) => asteroid.has_spectral_data).length / largeDataset.length) * 100,
      });

      const renderTime = measurer.measure('taxonomy-tree-large-render', () => {
        render(
          <AppProvider>
            <TaxonomyTree virtualScrollThreshold={50} />
          </AppProvider>
        );
      });

      expect(renderTime).toBeLessThan(300); // Should render within 300ms

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Should show classification counts
      const classificationElements = screen.getAllByText(/\(\d+\)/);
      expect(classificationElements.length).toBeGreaterThan(0);
    });

    it('should use virtual scrolling for classifications with many asteroids', async () => {
      const largeClassification = generateLargeAsteroidDataset(1000).map(a => ({
        ...a,
        bus_demeo_class: 'C'
      }));

      vi.mocked(apiClient.getClassificationMetadata).mockResolvedValue({
        system: 'bus_demeo',
        classes: [{
          name: 'C',
          total_count: largeClassification.length,
          spectral_count: largeClassification.filter((asteroid) => asteroid.has_spectral_data).length,
          spectral_percentage:
            (largeClassification.filter((asteroid) => asteroid.has_spectral_data).length / largeClassification.length) * 100,
        }],
        total_asteroids: largeClassification.length,
        total_with_spectra: largeClassification.filter((asteroid) => asteroid.has_spectral_data).length,
        overall_spectral_percentage:
          (largeClassification.filter((asteroid) => asteroid.has_spectral_data).length / largeClassification.length) * 100,
      });
      vi.mocked(apiClient.getClassificationAsteroidsPage).mockResolvedValue(
        generatePaginatedResponse(largeClassification, 1, 100)
      );

      const { container } = render(
        <AppProvider>
          <TaxonomyTree virtualScrollThreshold={50} />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
      });

      // Expand classification
      const expansionTime = measurer.measure('expand-large-classification', () => {
        fireEvent.click(screen.getByText('C'));
      });

      // Allow small CI/VM jitter while still enforcing fast expansion behavior.
      expect(expansionTime).toBeLessThan(150);

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
        const asteroidItems = container.querySelectorAll('.asteroid-item');
        expect(asteroidItems.length).toBeLessThan(50); // Virtual scrolling should limit rendered items
        expect(asteroidItems.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Memory Management Tests', () => {
    it('should not leak memory with repeated large dataset operations', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform multiple operations with large datasets
      for (let i = 0; i < 10; i++) {
        const items = generateLargeAsteroidDataset(1000);
        
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

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle component unmounting with large datasets gracefully', () => {
      const items = generateLargeAsteroidDataset(5000);

      const { unmount } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => <div key={item.id}>{item.proper_name}</div>}
        />
      );

      const unmountTime = measurer.measure('unmount-large-dataset', () => {
        unmount();
      });

      expect(unmountTime).toBeLessThan(100); // Should unmount quickly
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain acceptable performance with increasing dataset sizes', () => {
      const sizes = [100, 500, 1000, 2000, 5000];
      const renderTimes: number[] = [];

      sizes.forEach(size => {
        const items = generateLargeAsteroidDataset(size);
        
        const renderTime = measurer.measure(`render-${size}-items`, () => {
          const { unmount } = render(
            <VirtualScrollList
              items={items}
              itemHeight={60}
              containerHeight={400}
              renderItem={(item) => <div key={item.id}>{item.proper_name}</div>}
            />
          );
          unmount();
        });

        renderTimes.push(renderTime);
      });

      // Performance should not degrade significantly with size
      // (virtual scrolling should keep it roughly constant)
      const maxTime = Math.max(...renderTimes);
      const minTime = Math.min(...renderTimes);
      const performanceRatio = maxTime / minTime;

      // Full-suite jsdom runs introduce timing variance; keep a meaningful guardrail
      // without failing on minor scheduler jitter.
      expect(performanceRatio).toBeLessThan(4); // Should not be more than 4x slower
      expect(maxTime).toBeLessThan(500); // Absolute maximum time
    });
  });
});
