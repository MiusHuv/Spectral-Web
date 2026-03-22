import { useState, useCallback, useRef, useMemo } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PaginationCacheOptions {
  maxCacheSize?: number;
  defaultTTL?: number; // Time to live in milliseconds
  enableLRU?: boolean; // Least Recently Used eviction
}

export interface PaginationCache<T> {
  get: (key: string) => T | null;
  set: (key: string, data: T, ttl?: number) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  size: () => number;
  getStats: () => {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
  };
}

export const usePaginationCache = <T>(options: PaginationCacheOptions = {}): PaginationCache<T> => {
  const {
    maxCacheSize = 100,
    defaultTTL = 5 * 60 * 1000, // 5 minutes
    enableLRU = true
  } = options;

  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const accessOrderRef = useRef<string[]>([]);
  const statsRef = useRef({ hits: 0, misses: 0 });

  const [, forceUpdate] = useState({});

  // Clean expired entries
  const cleanExpired = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    const accessOrder = accessOrderRef.current;

    const keysToDelete: string[] = [];
    cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      cache.delete(key);
      const index = accessOrder.indexOf(key);
      if (index > -1) {
        accessOrder.splice(index, 1);
      }
    });
  }, []);

  // Evict least recently used entries if cache is full
  const evictLRU = useCallback(() => {
    if (!enableLRU) return;

    const cache = cacheRef.current;
    const accessOrder = accessOrderRef.current;

    while (cache.size >= maxCacheSize && accessOrder.length > 0) {
      const oldestKey = accessOrder.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
  }, [maxCacheSize, enableLRU]);

  // Update access order for LRU
  const updateAccessOrder = useCallback((key: string) => {
    if (!enableLRU) return;

    const accessOrder = accessOrderRef.current;
    const index = accessOrder.indexOf(key);
    
    if (index > -1) {
      accessOrder.splice(index, 1);
    }
    accessOrder.push(key);
  }, [enableLRU]);

  const get = useCallback((key: string): T | null => {
    cleanExpired();
    
    const cache = cacheRef.current;
    const entry = cache.get(key);
    
    if (!entry) {
      statsRef.current.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      cache.delete(key);
      const accessOrder = accessOrderRef.current;
      const index = accessOrder.indexOf(key);
      if (index > -1) {
        accessOrder.splice(index, 1);
      }
      statsRef.current.misses++;
      return null;
    }

    statsRef.current.hits++;
    updateAccessOrder(key);
    return entry.data;
  }, [cleanExpired, updateAccessOrder]);

  const set = useCallback((key: string, data: T, ttl?: number): void => {
    cleanExpired();
    evictLRU();

    const cache = cacheRef.current;
    const now = Date.now();
    const expiresAt = now + (ttl || defaultTTL);

    cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    });

    updateAccessOrder(key);
    forceUpdate({});
  }, [cleanExpired, evictLRU, defaultTTL, updateAccessOrder]);

  const has = useCallback((key: string): boolean => {
    cleanExpired();
    return cacheRef.current.has(key);
  }, [cleanExpired]);

  const deleteEntry = useCallback((key: string): boolean => {
    const cache = cacheRef.current;
    const accessOrder = accessOrderRef.current;
    
    const deleted = cache.delete(key);
    if (deleted) {
      const index = accessOrder.indexOf(key);
      if (index > -1) {
        accessOrder.splice(index, 1);
      }
      forceUpdate({});
    }
    
    return deleted;
  }, []);

  const clear = useCallback((): void => {
    cacheRef.current.clear();
    accessOrderRef.current.length = 0;
    statsRef.current = { hits: 0, misses: 0 };
    forceUpdate({});
  }, []);

  const size = useCallback((): number => {
    cleanExpired();
    return cacheRef.current.size;
  }, [cleanExpired]);

  const getStats = useCallback(() => {
    const stats = statsRef.current;
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;

    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate,
      size: cacheRef.current.size,
      maxSize: maxCacheSize
    };
  }, [maxCacheSize]);

  return useMemo(() => ({
    get,
    set,
    has,
    delete: deleteEntry,
    clear,
    size,
    getStats
  }), [get, set, has, deleteEntry, clear, size, getStats]);
};

// Hook for managing paginated asteroid data with caching
export interface PaginatedAsteroidData {
  asteroids: Array<{
    id: number;
    official_number?: number;
    proper_name?: string;
    provisional_designation?: string;
    bus_demeo_class?: string;
    tholen_class?: string;
    display_name?: string;
    has_spectral_data?: boolean;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
  };
}

export interface PaginatedAsteroidCache {
  getPage: (
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    pageSize?: number
  ) => PaginatedAsteroidData | null;
  
  setPage: (
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    data: PaginatedAsteroidData,
    pageSize?: number
  ) => void;
  
  hasPage: (
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    pageSize?: number
  ) => boolean;
  
  clearClassification: (
    system: 'bus_demeo' | 'tholen',
    classification: string
  ) => void;
  
  clearSystem: (system: 'bus_demeo' | 'tholen') => void;
  
  clear: () => void;
  
  getStats: () => {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
  };
}

export const usePaginatedAsteroidCache = (options: PaginationCacheOptions = {}): PaginatedAsteroidCache => {
  const cache = usePaginationCache<PaginatedAsteroidData>(options);

  const getCacheKey = useCallback((
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    pageSize: number = 100
  ): string => {
    return `${system}-${classification}-${page}-${pageSize}`;
  }, []);

  const getPage = useCallback((
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    pageSize: number = 100
  ): PaginatedAsteroidData | null => {
    const key = getCacheKey(system, classification, page, pageSize);
    return cache.get(key);
  }, [cache, getCacheKey]);

  const setPage = useCallback((
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    data: PaginatedAsteroidData,
    pageSize: number = 100
  ): void => {
    const key = getCacheKey(system, classification, page, pageSize);
    cache.set(key, data);
  }, [cache, getCacheKey]);

  const hasPage = useCallback((
    system: 'bus_demeo' | 'tholen',
    classification: string,
    page: number,
    pageSize: number = 100
  ): boolean => {
    const key = getCacheKey(system, classification, page, pageSize);
    return cache.has(key);
  }, [cache, getCacheKey]);

  const clearClassification = useCallback((
    system: 'bus_demeo' | 'tholen',
    classification: string
  ): void => {
    // Delete all possible keys for this classification
    // We need to check a reasonable range of pages and page sizes
    for (let page = 1; page <= 100; page++) {
      for (const pageSize of [25, 50, 100, 200, 500]) {
        const key = getCacheKey(system, classification, page, pageSize);
        cache.delete(key);
      }
    }
  }, [cache, getCacheKey]);

  const clearSystem = useCallback((system: 'bus_demeo' | 'tholen'): void => {
    // This is a simplified approach - in a real implementation,
    // you might want to track keys more efficiently
    cache.clear();
  }, [cache]);

  const clear = useCallback((): void => {
    cache.clear();
  }, [cache]);

  const getStats = useCallback(() => {
    return cache.getStats();
  }, [cache]);

  return useMemo(() => ({
    getPage,
    setPage,
    hasPage,
    clearClassification,
    clearSystem,
    clear,
    getStats
  }), [getPage, setPage, hasPage, clearClassification, clearSystem, clear, getStats]);
};
