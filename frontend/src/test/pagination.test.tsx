/**
 * Test file for pagination functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaginationCache, usePaginatedAsteroidCache } from '../hooks/usePaginationCache';

describe('Pagination Cache', () => {
  describe('usePaginationCache', () => {
    it('should store and retrieve cached data', () => {
      const { result } = renderHook(() => usePaginationCache<string>());
      
      act(() => {
        result.current.set('test-key', 'test-value');
      });
      
      expect(result.current.get('test-key')).toBe('test-value');
      expect(result.current.has('test-key')).toBe(true);
      expect(result.current.size()).toBe(1);
    });

    it('should handle cache expiration', async () => {
      const { result } = renderHook(() => 
        usePaginationCache<string>({ defaultTTL: 100 }) // 100ms TTL
      );
      
      act(() => {
        result.current.set('test-key', 'test-value');
      });
      
      expect(result.current.get('test-key')).toBe('test-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(result.current.get('test-key')).toBeNull();
    });

    it('should implement LRU eviction', () => {
      const { result } = renderHook(() => 
        usePaginationCache<string>({ maxCacheSize: 2, enableLRU: true })
      );
      
      act(() => {
        result.current.set('key1', 'value1');
        result.current.set('key2', 'value2');
        result.current.set('key3', 'value3'); // Should evict key1
      });
      
      expect(result.current.get('key1')).toBeNull();
      expect(result.current.get('key2')).toBe('value2');
      expect(result.current.get('key3')).toBe('value3');
    });

    it('should track cache statistics', () => {
      const { result } = renderHook(() => usePaginationCache<string>());
      
      act(() => {
        result.current.set('test-key', 'test-value');
      });
      
      // Hit
      act(() => {
        result.current.get('test-key');
      });
      
      // Miss
      act(() => {
        result.current.get('non-existent-key');
      });
      
      const stats = result.current.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('usePaginatedAsteroidCache', () => {
    it('should generate correct cache keys', () => {
      const { result } = renderHook(() => usePaginatedAsteroidCache());
      
      const testData = {
        asteroids: [
          {
            id: 1,
            display_name: 'Test Asteroid',
            has_spectral_data: true
          }
        ],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false
        }
      };
      
      act(() => {
        result.current.setPage('bus_demeo', 'C', 1, testData);
      });
      
      expect(result.current.hasPage('bus_demeo', 'C', 1)).toBe(true);
      expect(result.current.getPage('bus_demeo', 'C', 1)).toEqual(testData);
    });

    it('should clear classification cache', () => {
      const { result } = renderHook(() => usePaginatedAsteroidCache());
      
      const testData = {
        asteroids: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
          hasMore: false,
          hasPrevious: false
        }
      };
      
      act(() => {
        result.current.setPage('bus_demeo', 'C', 1, testData);
        result.current.setPage('bus_demeo', 'C', 2, testData);
        result.current.setPage('bus_demeo', 'S', 1, testData);
      });
      
      act(() => {
        result.current.clearClassification('bus_demeo', 'C');
      });
      
      expect(result.current.hasPage('bus_demeo', 'C', 1)).toBe(false);
      expect(result.current.hasPage('bus_demeo', 'C', 2)).toBe(false);
      expect(result.current.hasPage('bus_demeo', 'S', 1)).toBe(true);
    });
  });
});

describe('Pagination Integration', () => {
  it('should handle pagination workflow', () => {
    const { result } = renderHook(() => usePaginatedAsteroidCache());
    
    // Simulate loading multiple pages
    const pages = [
      {
        page: 1,
        data: {
          asteroids: [{ id: 1, display_name: 'Asteroid 1', has_spectral_data: true }],
          pagination: { page: 1, pageSize: 1, total: 3, totalPages: 3, hasMore: true, hasPrevious: false }
        }
      },
      {
        page: 2,
        data: {
          asteroids: [{ id: 2, display_name: 'Asteroid 2', has_spectral_data: false }],
          pagination: { page: 2, pageSize: 1, total: 3, totalPages: 3, hasMore: true, hasPrevious: true }
        }
      },
      {
        page: 3,
        data: {
          asteroids: [{ id: 3, display_name: 'Asteroid 3', has_spectral_data: true }],
          pagination: { page: 3, pageSize: 1, total: 3, totalPages: 3, hasMore: false, hasPrevious: true }
        }
      }
    ];
    
    act(() => {
      pages.forEach(({ page, data }) => {
        result.current.setPage('bus_demeo', 'C', page, data);
      });
    });
    
    // Verify all pages are cached
    pages.forEach(({ page, data }) => {
      expect(result.current.hasPage('bus_demeo', 'C', page)).toBe(true);
      expect(result.current.getPage('bus_demeo', 'C', page)).toEqual(data);
    });
    
    // Verify cache stats
    const stats = result.current.getStats();
    expect(stats.size).toBe(3);
  });
});