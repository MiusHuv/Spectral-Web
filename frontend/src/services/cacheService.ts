/**
 * Enhanced caching service for the frontend application.
 * Provides multi-level caching, cache warming, and performance monitoring.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  totalRequests: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableLRU: boolean;
  enableStats: boolean;
}

class EnhancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private stats = { hits: 0, misses: 0 };
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enableLRU: true,
      enableStats: true,
      ...config
    };
  }

  get(key: string): T | null {
    this.cleanExpired();
    
    const entry = this.cache.get(key);
    if (!entry) {
      if (this.config.enableStats) this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      if (this.config.enableStats) this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = now;
    
    if (this.config.enableLRU) {
      this.updateAccessOrder(key);
    }
    
    if (this.config.enableStats) this.stats.hits++;
    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    this.cleanExpired();
    this.enforceSizeLimit();

    const now = Date.now();
    const expiresAt = now + (ttl || this.config.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
      accessCount: 1,
      lastAccess: now
    });

    if (this.config.enableLRU) {
      this.updateAccessOrder(key);
    }
  }

  has(key: string): boolean {
    this.cleanExpired();
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalRequests
    };
  }

  getHotKeys(limit: number = 10): Array<{ key: string; accessCount: number; lastAccess: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccess: entry.lastAccess
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return entries;
  }

  private cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
  }

  private enforceSizeLimit(): void {
    if (!this.config.enableLRU) return;

    while (this.cache.size >= this.config.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

class MultiLevelCacheService {
  private l1Cache: EnhancedCache<any>;
  private l2Cache: EnhancedCache<any>;
  private warmingQueue = new Set<string>();
  private accessPatterns = new Map<string, { frequency: number; lastAccess: number }>();
  private requestStats = { hits: 0, misses: 0 };

  constructor() {
    // L1: Fast, small cache for frequently accessed data
    this.l1Cache = new EnhancedCache({
      maxSize: 200,
      defaultTTL: 2 * 60 * 1000, // 2 minutes
      enableLRU: true,
      enableStats: true
    });

    // L2: Larger, longer-lived cache for less frequent data
    this.l2Cache = new EnhancedCache({
      maxSize: 1000,
      defaultTTL: 10 * 60 * 1000, // 10 minutes
      enableLRU: true,
      enableStats: true
    });
  }

  get<T>(key: string): T | null {
    // Try L1 first
    let value = this.l1Cache.get(key);
    if (value !== null) {
      this.requestStats.hits++;
      this.trackAccess(key, 'l1_hit');
      return value;
    }

    // Try L2
    value = this.l2Cache.get(key);
    if (value !== null) {
      // Promote to L1 if frequently accessed
      if (this.shouldPromoteToL1(key)) {
        this.l1Cache.set(key, value);
      }
      this.requestStats.hits++;
      this.trackAccess(key, 'l2_hit');
      return value;
    }

    this.requestStats.misses++;
    this.trackAccess(key, 'miss');
    return null;
  }

  set<T>(key: string, data: T, options: { promoteToL1?: boolean; ttl?: number } = {}): void {
    const { promoteToL1 = false, ttl } = options;

    // Always store in L2
    this.l2Cache.set(key, data, ttl);

    // Optionally promote to L1
    if (promoteToL1 || this.shouldPromoteToL1(key)) {
      this.l1Cache.set(key, data, ttl ? Math.min(ttl, 2 * 60 * 1000) : undefined);
    }

    this.trackAccess(key, 'set');
  }

  has(key: string): boolean {
    return this.l1Cache.has(key) || this.l2Cache.has(key);
  }

  delete(key: string): boolean {
    const l1Deleted = this.l1Cache.delete(key);
    const l2Deleted = this.l2Cache.delete(key);
    return l1Deleted || l2Deleted;
  }

  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.accessPatterns.clear();
    this.warmingQueue.clear();
    this.requestStats = { hits: 0, misses: 0 };
  }

  warmCache(keysAndValues: Array<{ key: string; value: any; promoteToL1?: boolean }>): void {
    keysAndValues.forEach(({ key, value, promoteToL1 = false }) => {
      if (!this.warmingQueue.has(key)) {
        this.set(key, value, { promoteToL1 });
        this.warmingQueue.add(key);
      }
    });
  }

  getStats() {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    const totalHits = this.requestStats.hits;
    const totalMisses = this.requestStats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      l1: l1Stats,
      l2: l2Stats,
      overall: {
        totalHits,
        totalMisses,
        totalRequests,
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
        l1HitRate: totalRequests > 0 ? l1Stats.hits / totalRequests : 0,
        l2HitRate: totalRequests > 0 ? l2Stats.hits / totalRequests : 0
      },
      accessPatternsTracked: this.accessPatterns.size,
      warmingQueueSize: this.warmingQueue.size
    };
  }

  getOptimizationSuggestions() {
    const stats = this.getStats();
    const suggestions = [];

    // Check hit rates
    if (stats.overall.hitRate < 0.7) {
      suggestions.push({
        type: 'low_hit_rate',
        priority: 'high',
        message: `Overall hit rate is ${(stats.overall.hitRate * 100).toFixed(1)}%. Consider cache tuning.`,
        actions: ['Increase cache sizes', 'Extend TTL values', 'Improve cache warming']
      });
    }

    // Check L1 utilization
    if (stats.l1.size / stats.l1.maxSize > 0.9) {
      suggestions.push({
        type: 'l1_full',
        priority: 'medium',
        message: 'L1 cache is nearly full. Consider expansion.',
        actions: ['Increase L1 cache size', 'Optimize promotion strategy']
      });
    }

    // Check access patterns
    const hotKeys = this.getHotAccessPatterns();
    if (hotKeys.length > stats.l1.maxSize * 0.8) {
      suggestions.push({
        type: 'hot_data_overflow',
        priority: 'medium',
        message: 'Many hot keys exceed L1 capacity.',
        actions: ['Increase L1 cache size', 'Improve promotion algorithm']
      });
    }

    return {
      suggestions,
      hotKeys: hotKeys.slice(0, 10),
      performance: {
        efficiency: stats.overall.hitRate > 0.8 ? 'excellent' : 
                   stats.overall.hitRate > 0.6 ? 'good' : 'needs_improvement'
      }
    };
  }

  private trackAccess(key: string, type: 'l1_hit' | 'l2_hit' | 'miss' | 'set'): void {
    const pattern = this.accessPatterns.get(key) || { frequency: 0, lastAccess: 0 };
    pattern.frequency++;
    pattern.lastAccess = Date.now();
    this.accessPatterns.set(key, pattern);
  }

  private shouldPromoteToL1(key: string): boolean {
    const pattern = this.accessPatterns.get(key);
    if (!pattern) return false;

    // Promote if accessed frequently and recently
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    const frequencyThreshold = 3;

    return pattern.frequency >= frequencyThreshold && 
           (Date.now() - pattern.lastAccess) < recentThreshold;
  }

  private getHotAccessPatterns(): Array<{ key: string; frequency: number; lastAccess: number }> {
    return Array.from(this.accessPatterns.entries())
      .map(([key, pattern]) => ({ key, ...pattern }))
      .sort((a, b) => b.frequency - a.frequency);
  }
}

// Cache warming strategies
class CacheWarmingService {
  private multiLevelCache: MultiLevelCacheService;
  private strategies = new Map<string, {
    loader: () => Promise<Array<{ key: string; value: any; promoteToL1?: boolean }>>;
    interval: number;
    lastRun: number;
  }>();

  constructor(cache: MultiLevelCacheService) {
    this.multiLevelCache = cache;
  }

  registerStrategy(
    name: string, 
    loader: () => Promise<Array<{ key: string; value: any; promoteToL1?: boolean }>>,
    interval: number
  ): void {
    this.strategies.set(name, {
      loader,
      interval,
      lastRun: 0
    });
  }

  async executeStrategies(): Promise<{ [strategyName: string]: { status: string; itemsWarmed?: number; error?: string } }> {
    const results: { [key: string]: any } = {};
    const now = Date.now();

    for (const [name, strategy] of this.strategies.entries()) {
      if (now - strategy.lastRun >= strategy.interval) {
        try {
          const warmingData = await strategy.loader();
          this.multiLevelCache.warmCache(warmingData);
          
          strategy.lastRun = now;
          results[name] = {
            status: 'success',
            itemsWarmed: warmingData.length
          };
        } catch (error) {
          results[name] = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    return results;
  }
}

// Global cache service instance
export const cacheService = new MultiLevelCacheService();
export const cacheWarmingService = new CacheWarmingService(cacheService);

// Setup default warming strategies
cacheWarmingService.registerStrategy(
  'classification_metadata',
  async () => {
    // This would be called by components that have access to API
    return [];
  },
  5 * 60 * 1000 // 5 minutes
);

export { EnhancedCache, MultiLevelCacheService, CacheWarmingService };
