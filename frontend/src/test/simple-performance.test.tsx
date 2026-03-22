/**
 * Simple performance tests for React components.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { performance } from 'perf_hooks';

import VirtualScrollList from '../components/common/VirtualScrollList';

// Mock data generator
const generateMockItems = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: Math.random(),
  }));
};

describe('Simple Performance Tests', () => {
  test('VirtualScrollList should render large lists efficiently', () => {
    const items = generateMockItems(1000);
    
    const startTime = performance.now();
    
    const { container } = render(
      <VirtualScrollList
        items={items}
        itemHeight={60}
        containerHeight={400}
        renderItem={(item) => (
          <div key={item.id}>
            {item.name} - {item.value.toFixed(2)}
          </div>
        )}
      />
    );
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render quickly even with 1000 items
    expect(renderTime).toBeLessThan(100); // 100ms threshold
    
    // Should only render visible items (not all 1000)
    const renderedItems = container.querySelectorAll('.virtual-scroll-item');
    expect(renderedItems.length).toBeLessThan(20); // Only visible items should be rendered
    
    console.log(`VirtualScrollList render time: ${renderTime.toFixed(2)}ms`);
    console.log(`Rendered items: ${renderedItems.length} out of ${items.length}`);
  });

  test('React.memo should prevent unnecessary re-renders', () => {
    let renderCount = 0;
    
    const MemoizedComponent = React.memo(() => {
      renderCount++;
      return <div>Memoized Component</div>;
    });

    const ParentComponent = ({ value }: { value: number }) => (
      <div>
        <div>Value: {value}</div>
        <MemoizedComponent />
      </div>
    );

    const { rerender } = render(<ParentComponent value={1} />);
    expect(renderCount).toBe(1);

    // Re-render with same props - memo should prevent re-render
    rerender(<ParentComponent value={1} />);
    expect(renderCount).toBe(1);

    // Re-render with different props - should still not re-render MemoizedComponent
    rerender(<ParentComponent value={2} />);
    expect(renderCount).toBe(1);
    
    console.log(`React.memo prevented ${2} unnecessary re-renders`);
  });
});