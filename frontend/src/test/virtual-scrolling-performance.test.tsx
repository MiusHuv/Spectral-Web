/**
 * Performance tests for virtual scrolling with different dataset sizes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import VirtualScrollList from '../components/common/VirtualScrollList';
import { TestPerformanceMeasurer, generateLargeAsteroidDataset } from './test-helpers/largeDataset';

type LargeDatasetItem = ReturnType<typeof generateLargeAsteroidDataset>[number] & {
  updated?: string;
};

// Mock IntersectionObserver for virtual scrolling tests
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('Virtual Scrolling Performance Tests', () => {
  let measurer: TestPerformanceMeasurer;

  beforeEach(() => {
    measurer = new TestPerformanceMeasurer();
  });

  afterEach(() => {
    const stats = measurer.getAllStats();
    if (Object.keys(stats).length > 0) {
      console.log('Virtual scrolling performance measurements:', stats);
    }
    measurer.clear();
  });

  describe('Dataset Size Performance', () => {
    const testSizes = [100, 500, 1000, 2000, 5000, 10000];

    testSizes.forEach(size => {
      it(`should render ${size} items efficiently`, () => {
        const items = generateLargeAsteroidDataset(size);

        const renderTime = measurer.measure(`render-${size}-items`, () => {
          render(
            <VirtualScrollList
              items={items}
              itemHeight={60}
              containerHeight={400}
              renderItem={(item) => (
                <div key={item.id} data-testid={`item-${item.id}`}>
                  {item.proper_name} - {item.bus_demeo_class}
                </div>
              )}
            />
          );
        });

        // Render time should not increase significantly with dataset size
        expect(renderTime).toBeLessThan(300); // 300ms max for any size

        // Should only render visible items regardless of dataset size
        const visibleItems = screen.getAllByTestId(/item-\d+/);
        expect(visibleItems.length).toBeLessThan(20); // Only ~7-8 items should be visible
      });
    });

    it('should maintain consistent performance across different sizes', () => {
      const renderTimes: number[] = [];

      testSizes.forEach(size => {
        const items = generateLargeAsteroidDataset(size);

        const renderTime = measurer.measure(`consistency-${size}`, () => {
          const { unmount } = render(
            <VirtualScrollList
              items={items}
              itemHeight={60}
              containerHeight={400}
              renderItem={(item) => (
                <div key={item.id}>{item.proper_name}</div>
              )}
            />
          );
          unmount();
        });

        renderTimes.push(renderTime);
      });

      // Performance should not degrade significantly
      const maxTime = Math.max(...renderTimes);
      const minTime = Math.min(...renderTimes);
      const performanceRatio = maxTime / minTime;

      expect(performanceRatio).toBeLessThan(6); // Keep scalability check while reducing flakiness
    });
  });

  describe('Scrolling Performance', () => {
    it('should handle rapid scrolling through large datasets', async () => {
      const items = generateLargeAsteroidDataset(5000);

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

      // Test rapid scrolling
      const scrollPositions = [0, 1000, 5000, 10000, 15000, 20000, 25000];
      
      for (let i = 0; i < scrollPositions.length; i++) {
        const position = scrollPositions[i];
        
        const scrollTime = measurer.measure(`rapid-scroll-${i}`, () => {
          fireEvent.scroll(scrollContainer!, { target: { scrollTop: position } });
        });

        expect(scrollTime).toBeLessThan(50); // Each scroll should be very fast

        // Wait for scroll to settle
        await waitFor(() => {
          expect(scrollContainer!.scrollTop).toBe(position);
        }, { timeout: 100 });
      }
    });

    it('should handle continuous scrolling smoothly', async () => {
      const items = generateLargeAsteroidDataset(3000);

      const { container } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id}>{item.proper_name}</div>
          )}
        />
      );

      const scrollContainer = container.querySelector('.virtual-scroll-container');
      
      // Simulate continuous scrolling
      const scrollDuration = 1000; // 1 second
      const scrollStep = 100;
      const totalSteps = scrollDuration / scrollStep;
      const maxScroll = items.length * 60 - 400; // Total height - container height
      
      let totalScrollTime = 0;

      for (let step = 0; step < totalSteps; step++) {
        const scrollPosition = (step / totalSteps) * maxScroll;
        
        const scrollTime = measurer.measure(`continuous-scroll-${step}`, () => {
          fireEvent.scroll(scrollContainer!, { target: { scrollTop: scrollPosition } });
        });

        totalScrollTime += scrollTime;
        
        // Each individual scroll should be fast
        // Individual scroll steps can spike under full-suite jsdom load while
        // still remaining comfortably interactive.
        expect(scrollTime).toBeLessThan(50);
        
        // Small delay to simulate realistic scrolling
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Total scrolling should be efficient
      expect(totalScrollTime).toBeLessThan(200); // Total time for all scrolls
    });
  });

  describe('Item Rendering Performance', () => {
    it('should render complex items efficiently', () => {
      const items = generateLargeAsteroidDataset(2000);

      const ComplexItem = ({ item }: { item: any }) => (
        <div className="complex-item" style={{ padding: '10px', border: '1px solid #ccc' }}>
          <div className="item-header">
            <strong>{item.proper_name}</strong>
            <span className="item-id">#{item.id}</span>
          </div>
          <div className="item-details">
            <span>Class: {item.bus_demeo_class}</span>
            <span>Diameter: {item.physical_properties?.diameter?.toFixed(2) || 'N/A'} km</span>
            <span>Albedo: {item.physical_properties?.albedo?.toFixed(3) || 'N/A'}</span>
          </div>
          <div className="item-orbital">
            <span>a: {item.orbital_elements?.semi_major_axis?.toFixed(3) || 'N/A'} AU</span>
            <span>e: {item.orbital_elements?.eccentricity?.toFixed(3) || 'N/A'}</span>
            <span>i: {item.orbital_elements?.inclination?.toFixed(1) || 'N/A'}°</span>
          </div>
        </div>
      );

      const renderTime = measurer.measure('complex-items-render', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={80}
            containerHeight={400}
            renderItem={(item) => <ComplexItem key={item.id} item={item} />}
          />
        );
      });

      // Should render complex items efficiently
      expect(renderTime).toBeLessThan(400);
    });

    it('should handle item updates efficiently', async () => {
      let items: LargeDatasetItem[] = generateLargeAsteroidDataset(1000);

      const { rerender } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.proper_name} - Updated: {item.updated || 'No'}
            </div>
          )}
        />
      );

      // Update some items
      const updateTime = measurer.measure('item-updates', () => {
        items = items.map((item, index) => 
          index < 100 ? { ...item, updated: 'Yes' } : item
        );

        rerender(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id} data-testid={`item-${item.id}`}>
                {item.proper_name} - Updated: {item.updated || 'No'}
              </div>
            )}
          />
        );
      });

      expect(updateTime).toBeLessThan(100); // Updates should be fast

      // Check that updates are reflected
      await waitFor(() => {
        const updatedItems = screen.getAllByText(/Updated: Yes/);
        expect(updatedItems.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Load More Performance', () => {
    it('should handle load more functionality efficiently', async () => {
      const initialItems = generateLargeAsteroidDataset(500);
      let allItems = [...initialItems];
      let hasMore = true;
      let isLoading = false;

      const mockLoadMore = vi.fn(() => {
        isLoading = true;
        setTimeout(() => {
          const newItems = generateLargeAsteroidDataset(500).map(item => ({
            ...item,
            id: item.id + allItems.length,
          }));
          allItems = [...allItems, ...newItems];
          isLoading = false;
          hasMore = allItems.length < 2000; // Stop at 2000 items
        }, 100);
      });

      const { container, rerender } = render(
        <VirtualScrollList
          items={allItems}
          itemHeight={60}
          containerHeight={400}
          hasMore={hasMore}
          isLoadingMore={isLoading}
          onLoadMore={mockLoadMore}
          renderItem={(item) => (
            <div key={item.id}>{item.proper_name}</div>
          )}
        />
      );

      const scrollContainer = container.querySelector('.virtual-scroll-container');

      // Scroll to bottom to trigger load more
      const triggerTime = measurer.measure('load-more-trigger', () => {
        fireEvent.scroll(scrollContainer!, {
          target: {
            scrollTop: scrollContainer!.scrollHeight - scrollContainer!.clientHeight - 50
          }
        });
      });

      expect(triggerTime).toBeLessThan(50);

      await waitFor(() => {
        expect(mockLoadMore).toHaveBeenCalled();
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(allItems.length).toBe(1000);
      }, { timeout: 200 });

      // Re-render with new items
      const rerenderTime = measurer.measure('load-more-rerender', () => {
        rerender(
          <VirtualScrollList
            items={allItems}
            itemHeight={60}
            containerHeight={400}
            hasMore={hasMore}
            isLoadingMore={isLoading}
            onLoadMore={mockLoadMore}
            renderItem={(item) => (
              <div key={item.id}>{item.proper_name}</div>
            )}
          />
        );
      });

      expect(rerenderTime).toBeLessThan(100);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create memory leaks with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and destroy multiple large virtual scroll lists
      for (let i = 0; i < 5; i++) {
        const items = generateLargeAsteroidDataset(2000);
        
        const { unmount } = render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id}>
                <span>{item.proper_name}</span>
                <span>{item.bus_demeo_class}</span>
                <span>{JSON.stringify(item.orbital_elements)}</span>
              </div>
            )}
          />
        );

        // Scroll around to trigger rendering
        const container = document.querySelector('.virtual-scroll-container');
        expect(container).toBeInTheDocument();
        fireEvent.scroll(container!, { target: { scrollTop: 1000 } });
        fireEvent.scroll(container!, { target: { scrollTop: 2000 } });
        fireEvent.scroll(container!, { target: { scrollTop: 0 } });

        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    it('should efficiently handle item reference updates', () => {
      let items = generateLargeAsteroidDataset(1000);

      const { rerender } = render(
        <VirtualScrollList
          items={items}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item) => (
            <div key={item.id}>{item.proper_name}</div>
          )}
        />
      );

      // Update items multiple times (simulating real-time updates)
      for (let i = 0; i < 10; i++) {
        const updateTime = measurer.measure(`reference-update-${i}`, () => {
          // Create new array reference but same items
          items = [...items];
          
          rerender(
            <VirtualScrollList
              items={items}
              itemHeight={60}
              containerHeight={400}
              renderItem={(item) => (
                <div key={item.id}>{item.proper_name}</div>
              )}
            />
          );
        });

        expect(updateTime).toBeLessThan(50); // Should handle reference updates quickly
      }
    });
  });

  describe('Edge Cases Performance', () => {
    it('should handle empty datasets efficiently', () => {
      const emptyItems: Array<{ id: number; name: string }> = [];

      const renderTime = measurer.measure('empty-dataset', () => {
        render(
          <VirtualScrollList<{ id: number; name: string }>
            items={emptyItems}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => <div key={item.id}>{item.name}</div>}
          />
        );
      });

      expect(renderTime).toBeLessThan(50);
    });

    it('should handle single item efficiently', () => {
      const items = generateLargeAsteroidDataset(1);

      const renderTime = measurer.measure('single-item', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id}>{item.proper_name}</div>
            )}
          />
        );
      });

      expect(renderTime).toBeLessThan(50);
    });

    it('should handle very small container heights', () => {
      const items = generateLargeAsteroidDataset(1000);

      const renderTime = measurer.measure('small-container', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={60}
            containerHeight={60} // Only one item visible
            renderItem={(item) => (
              <div key={item.id}>{item.proper_name}</div>
            )}
          />
        );
      });

      expect(renderTime).toBeLessThan(100);

      // With the default overscan=5, jsdom should keep the visible item plus overscan buffered.
      const visibleItems = screen.getAllByText(/Asteroid \d+/);
      expect(visibleItems.length).toBeLessThanOrEqual(7);
    });

    it('should handle very large item heights', () => {
      const items = generateLargeAsteroidDataset(100);

      const renderTime = measurer.measure('large-item-height', () => {
        render(
          <VirtualScrollList
            items={items}
            itemHeight={200} // Large items
            containerHeight={400}
            renderItem={(item) => (
              <div key={item.id} style={{ height: '200px', padding: '20px' }}>
                <h3>{item.proper_name}</h3>
                <p>Class: {item.bus_demeo_class}</p>
                <p>ID: {item.id}</p>
              </div>
            )}
          />
        );
      });

      expect(renderTime).toBeLessThan(100);

      // With a 400px container, 200px items, and overscan=5, the list should keep 8 or fewer items mounted.
      const visibleItems = screen.getAllByText(/Asteroid \d+/);
      expect(visibleItems.length).toBeLessThanOrEqual(8);
    });
  });
});
