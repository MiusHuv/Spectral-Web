/**
 * Tests for the frontend caching system.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  EnhancedCache, 
  MultiLevelCacheService, 
  CacheWarmingService,
  cacheService 
} from '../services/cacheService';

describe('EnhancedCache', () => {
  let cache: EnhancedCache<string>;

  beforeEach(() => {
    cache = new EnhancedCache({
      maxSize: 5,
      defaultTTL: 1000, // 1 second
      enableLRU: true,
      enableStats: true
    });
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    expect(cache.has('key1')).toBe(true);
  });

  it('should handle TTL expiration', async () => {
    cache.set('key1', 'value1', 100); // 100ms TTL
    expect(cache.get('key1')).toBe('value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('key1')).toBeNull();
  });

  it('should enforce size limits with LRU eviction', () => {
    // Fill cache to capacity
    for (let i = 1; i <= 5; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    // Access key1 to make it recently used
    cache.get('key1');

    // Add one more item, should evict key2 (least recently used)
    cache.set('key6', 'value6');

    expect(cache.get('key1')).toBe('value1'); // Still there
    expect(cache.get('key2')).toBeNull();     // Evicted
    expect(cache.get('key6')).toBe('value6'); // New item
  });

  it('should track statistics correctly', () => {
    cache.set('key1', 'value1');
    
    // Generate hits and misses
    cache.get('key1'); // Hit
    cache.get('key2'); // Miss
    cache.get('key1'); // Hit
    cache.get('key3'); // Miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBe(0.5);
    expect(stats.totalRequests).toBe(4);
  });

  it('should identify hot keys', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    // Access key1 multiple times
    for (let i = 0; i < 5; i++) {
      cache.get('key1');
    }
    cache.get('key2'); // Access key2 once

    const hotKeys = cache.getHotKeys(2);
    expect(hotKeys).toHaveLength(2);
    expect(hotKeys[0].key).toBe('key1');
    expect(hotKeys[0].accessCount).toBeGreaterThan(hotKeys[1].accessCount);
  });

  it('should clear all data', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    cache.clear();
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
    expect(cache.getStats().size).toBe(0);
  });
});

describe('MultiLevelCacheService', () => {
  let multiCache: MultiLevelCacheService;

  beforeEach(() => {
    multiCache = new MultiLevelCacheService();
  });

  afterEach(() => {
    multiCache.clear();
  });

  it('should handle L1 and L2 cache levels', () => {
    // Set data with L1 promotion
    multiCache.set('key1', 'value1', { promoteToL1: true });
    
    // Set data without L1 promotion
    multiCache.set('key2', 'value2', { promoteToL1: false });

    // Both should be retrievable
    expect(multiCache.get('key1')).toBe('value1');
    expect(multiCache.get('key2')).toBe('value2');

    // Check cache levels directly
    expect(multiCache['l1Cache'].get('key1')).toBe('value1');
    expect(multiCache['l1Cache'].get('key2')).toBeNull();
    expect(multiCache['l2Cache'].get('key2')).toBe('value2');
  });

  it('should promote frequently accessed data to L1', () => {
    // Set data in L2 only
    multiCache.set('key1', 'value1', { promoteToL1: false });
    
    // Access multiple times to trigger promotion
    for (let i = 0; i < 5; i++) {
      multiCache.get('key1');
    }

    // Should now be in L1 (promotion happens on subsequent access)
    multiCache.get('key1');
    expect(multiCache['l1Cache'].get('key1')).toBe('value1');
  });

  it('should provide comprehensive statistics', () => {
    multiCache.set('key1', 'value1', { promoteToL1: true });
    multiCache.set('key2', 'value2', { promoteToL1: false });
    
    multiCache.get('key1'); // L1 hit
    multiCache.get('key2'); // L2 hit
    multiCache.get('key3'); // Miss

    const stats = multiCache.getStats();
    expect(stats.overall.totalRequests).toBe(3);
    expect(stats.overall.totalHits).toBe(2);
    expect(stats.overall.totalMisses).toBe(1);
    expect(stats.overall.hitRate).toBeCloseTo(2/3);
  });

  it('should warm cache with provided data', () => {
    const warmingData = [
      { key: 'warm1', value: 'data1', promoteToL1: true },
      { key: 'warm2', value: 'data2', promoteToL1: false }
    ];

    multiCache.warmCache(warmingData);

    expect(multiCache.get('warm1')).toBe('data1');
    expect(multiCache.get('warm2')).toBe('data2');
  });

  it('should generate optimization suggestions', () => {
    // Fill cache beyond L1 capacity to trigger suggestions
    for (let i = 0; i < 10; i++) {
      multiCache.set(`key${i}`, `value${i}`, { promoteToL1: true });
    }

    const suggestions = multiCache.getOptimizationSuggestions();
    expect(suggestions).toHaveProperty('suggestions');
    expect(suggestions).toHaveProperty('hotKeys');
    expect(suggestions).toHaveProperty('performance');
  });
});

describe('CacheWarmingService', () => {
  let multiCache: MultiLevelCacheService;
  let warmingService: CacheWarmingService;

  beforeEach(() => {
    multiCache = new MultiLevelCacheService();
    warmingService = new CacheWarmingService(multiCache);
  });

  afterEach(() => {
    multiCache.clear();
  });

  it('should register warming strategies', () => {
    const mockLoader = vi.fn().mockResolvedValue([
      { key: 'test1', value: 'data1' }
    ]);

    warmingService.registerStrategy('test-strategy', mockLoader, 1000);
    
    expect(warmingService['strategies'].has('test-strategy')).toBe(true);
  });

  it('should execute warming strategies', async () => {
    const mockLoader = vi.fn().mockResolvedValue([
      { key: 'test1', value: 'data1', promoteToL1: true },
      { key: 'test2', value: 'data2', promoteToL1: false }
    ]);

    warmingService.registerStrategy('test-strategy', mockLoader, 0); // Always run
    
    const results = await warmingService.executeStrategies();
    
    expect(results['test-strategy'].status).toBe('success');
    expect(results['test-strategy'].itemsWarmed).toBe(2);
    expect(multiCache.get('test1')).toBe('data1');
    expect(multiCache.get('test2')).toBe('data2');
  });

  it('should handle strategy execution errors', async () => {
    const mockLoader = vi.fn().mockRejectedValue(new Error('Loading failed'));

    warmingService.registerStrategy('failing-strategy', mockLoader, 0);
    
    const results = await warmingService.executeStrategies();
    
    expect(results['failing-strategy'].status).toBe('error');
    expect(results['failing-strategy'].error).toBe('Loading failed');
  });

  it('should respect strategy intervals', async () => {
    const mockLoader = vi.fn().mockResolvedValue([]);
    
    // Register strategy with 1 second interval
    warmingService.registerStrategy('interval-strategy', mockLoader, 1000);
    
    // Execute twice quickly
    await warmingService.executeStrategies();
    await warmingService.executeStrategies();
    
    // Should only have been called once due to interval
    expect(mockLoader).toHaveBeenCalledTimes(1);
  });
});

describe('Global Cache Service', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  it('should be a singleton instance', () => {
    const { cacheService: service1 } = require('../services/cacheService');
    const { cacheService: service2 } = require('../services/cacheService');
    
    expect(service1).toBe(service2);
  });

  it('should handle real-world caching scenarios', () => {
    // Simulate caching classification metadata
    const classificationData = {
      system: 'bus_demeo',
      classes: ['A', 'B', 'C', 'S'],
      total_asteroids: 1000
    };

    cacheService.set('classification_metadata_bus_demeo', classificationData, {
      promoteToL1: true
    });

    // Simulate caching spectral data
    const spectralData = {
      asteroid_id: 123,
      wavelengths: [0.5, 0.6, 0.7],
      reflectances: [0.8, 0.9, 0.85],
      normalized: true
    };

    cacheService.set('spectral_123', spectralData, {
      promoteToL1: false // Spectral data goes to L2
    });

    // Verify retrieval
    expect(cacheService.get('classification_metadata_bus_demeo')).toEqual(classificationData);
    expect(cacheService.get('spectral_123')).toEqual(spectralData);

    // Check statistics
    const stats = cacheService.getStats();
    expect(stats.overall.totalRequests).toBeGreaterThan(0);
  });

  it('should handle cache warming for popular data', () => {
    const popularData = [
      { 
        key: 'popular_classification_bus_demeo', 
        value: { classes: ['A', 'B', 'C'] },
        promoteToL1: true 
      },
      { 
        key: 'popular_classification_tholen', 
        value: { classes: ['S', 'C', 'M'] },
        promoteToL1: true 
      }
    ];

    cacheService.warmCache(popularData);

    // Verify warmed data is accessible
    expect(cacheService.get('popular_classification_bus_demeo')).toBeDefined();
    expect(cacheService.get('popular_classification_tholen')).toBeDefined();
  });
});