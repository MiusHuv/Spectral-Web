import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import './VirtualScrollList.css';

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  // Pagination support
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  loadMoreThreshold?: number; // Distance from bottom to trigger load more
  renderLoadMore?: () => React.ReactNode;
}

function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = '',
  overscan = 5,
  onScroll,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  loadMoreThreshold = 100,
  renderLoadMore
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggeredRef = useRef(false);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  // Get visible items
  const visibleItems = items.slice(startIndex, endIndex + 1);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // Check if we should load more
    if (hasMore && onLoadMore && !isLoadingMore && !loadMoreTriggeredRef.current) {
      const { scrollHeight, clientHeight } = event.currentTarget;
      const distanceFromBottom = scrollHeight - (newScrollTop + clientHeight);
      
      if (distanceFromBottom <= loadMoreThreshold) {
        loadMoreTriggeredRef.current = true;
        onLoadMore();
      }
    }
  }, [onScroll, hasMore, onLoadMore, isLoadingMore, loadMoreThreshold]);

  // Reset load more trigger when loading completes
  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreTriggeredRef.current = false;
    }
  }, [isLoadingMore]);

  // Scroll to specific item
  const scrollToItem = useCallback((index: number) => {
    if (containerRef.current) {
      const scrollTop = index * itemHeight;
      containerRef.current.scrollTop = scrollTop;
      setScrollTop(scrollTop);
    }
  }, [itemHeight]);

  // Expose scroll method via ref
  React.useImperativeHandle(containerRef, () => ({
    scrollToItem,
    scrollTop: scrollTop,
    container: containerRef.current
  } as any), [scrollToItem, scrollTop]);

  // Calculate if we need to show load more indicator
  const showLoadMore = hasMore || isLoadingMore;
  const loadMoreHeight = showLoadMore ? 60 : 0;
  const adjustedTotalHeight = totalHeight + loadMoreHeight;

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: adjustedTotalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              className="virtual-scroll-item"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
        
        {/* Load more indicator */}
        {showLoadMore && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
              height: loadMoreHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px'
            }}
            className="virtual-scroll-load-more"
          >
            {renderLoadMore ? renderLoadMore() : (
              <div className="load-more-default">
                {isLoadingMore ? (
                  <div className="loading-indicator">
                    <span className="spinner"></span>
                    Loading more...
                  </div>
                ) : hasMore ? (
                  <button 
                    className="load-more-button"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                  >
                    Load More
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(VirtualScrollList) as <T>(props: VirtualScrollListProps<T>) => JSX.Element;
