import { useState, useEffect, useCallback, useRef } from 'react';
import { SpectralData } from '../context/AppContext';
import { apiClient } from '../services/api';
import { cacheService } from '../services/cacheService';

interface SpectralDataCache {
  [asteroidId: number]: {
    data: SpectralData | null;
    loading: boolean;
    error: string | null;
    timestamp: number;
  };
}

interface UseSpectralDataCacheOptions {
  cacheTimeout?: number; // Cache timeout in milliseconds
  maxCacheSize?: number; // Maximum number of cached items
  prefetchDelay?: number; // Delay before prefetching in milliseconds
}

interface UseSpectralDataCacheReturn {
  getSpectralData: (asteroidId: number) => SpectralData | null;
  loadSpectralData: (asteroidId: number) => Promise<SpectralData | null>;
  loadSpectralDataBatch: (asteroidIds: number[]) => Promise<SpectralData[]>;
  prefetchSpectralData: (asteroidIds: number[]) => void;
  isLoading: (asteroidId: number) => boolean;
  getError: (asteroidId: number) => string | null;
  clearCache: () => void;
  getCacheStats: () => {
    local: {
      size: number;
      hitRate: number;
      hits: number;
      misses: number;
    };
    multiLevel: ReturnType<typeof cacheService.getStats>;
    combined: {
      totalRequests: number;
      overallHitRate: number;
    };
  };
}

export const useSpectralDataCache = (
  options: UseSpectralDataCacheOptions = {}
): UseSpectralDataCacheReturn => {
  const {
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
    maxCacheSize = 100,
    prefetchDelay = 500
  } = options;

  const [cache, setCache] = useState<SpectralDataCache>({});
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);
  const loadingPromisesRef = useRef<Map<number, Promise<SpectralData | null>>>(new Map());

  // Clean up expired cache entries
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    setCache(prevCache => {
      const newCache = { ...prevCache };
      let cleaned = false;

      Object.keys(newCache).forEach(key => {
        const asteroidId = parseInt(key);
        const entry = newCache[asteroidId];
        if (now - entry.timestamp > cacheTimeout) {
          delete newCache[asteroidId];
          cleaned = true;
        }
      });

      return cleaned ? newCache : prevCache;
    });
  }, [cacheTimeout]);

  // Enforce cache size limit (LRU eviction)
  const enforceCacheLimit = useCallback(() => {
    setCache(prevCache => {
      const entries = Object.entries(prevCache);
      if (entries.length <= maxCacheSize) {
        return prevCache;
      }

      // Sort by timestamp (oldest first) and remove excess entries
      const sortedEntries = entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      const entriesToKeep = sortedEntries.slice(-maxCacheSize);
      
      const newCache: SpectralDataCache = {};
      entriesToKeep.forEach(([key, value]) => {
        newCache[parseInt(key)] = value;
      });

      return newCache;
    });
  }, [maxCacheSize]);

  // Get cached spectral data with multi-level caching
  const getSpectralData = useCallback((asteroidId: number): SpectralData | null => {
    // Try multi-level cache first
    const cacheKey = `spectral_${asteroidId}`;
    const cachedData = cacheService.get<SpectralData>(cacheKey);
    
    if (cachedData) {
      cacheHitsRef.current++;
      return cachedData;
    }

    // Fallback to local cache for backward compatibility
    const entry = cache[asteroidId];
    if (!entry) {
      cacheMissesRef.current++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > cacheTimeout) {
      cacheMissesRef.current++;
      return null;
    }

    // Promote to multi-level cache
    if (entry.data) {
      cacheService.set(cacheKey, entry.data, { promoteToL1: true });
    }

    cacheHitsRef.current++;
    return entry.data;
  }, [cache, cacheTimeout]);

  // Check if data is currently loading
  const isLoading = useCallback((asteroidId: number): boolean => {
    return cache[asteroidId]?.loading || false;
  }, [cache]);

  // Get error for asteroid
  const getError = useCallback((asteroidId: number): string | null => {
    return cache[asteroidId]?.error || null;
  }, [cache]);

  // Load single spectral data
  const loadSpectralData = useCallback(async (asteroidId: number): Promise<SpectralData | null> => {
    // Check if already cached and valid
    const cached = getSpectralData(asteroidId);
    if (cached) {
      return cached;
    }

    // Check if already loading
    const existingPromise = loadingPromisesRef.current.get(asteroidId);
    if (existingPromise) {
      return existingPromise;
    }

    // Set loading state
    setCache(prevCache => ({
      ...prevCache,
      [asteroidId]: {
        data: null,
        loading: true,
        error: null,
        timestamp: Date.now()
      }
    }));

    // Create loading promise
    const loadingPromise = (async () => {
      try {
        const response = await apiClient.getAsteroidSpectrum(asteroidId);
        const spectralData: SpectralData = {
          asteroid_id: asteroidId,
          wavelengths: response.spectrum.wavelengths,
          reflectances: response.spectrum.reflectances,
          normalized: response.spectrum.normalized
        };

        // Update both local and multi-level cache
        const cacheKey = `spectral_${asteroidId}`;
        cacheService.set(cacheKey, spectralData, { promoteToL1: true });
        
        setCache(prevCache => ({
          ...prevCache,
          [asteroidId]: {
            data: spectralData,
            loading: false,
            error: null,
            timestamp: Date.now()
          }
        }));

        return spectralData;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load spectral data';
        
        // Update cache with error
        setCache(prevCache => ({
          ...prevCache,
          [asteroidId]: {
            data: null,
            loading: false,
            error: errorMessage,
            timestamp: Date.now()
          }
        }));

        return null;
      } finally {
        // Remove from loading promises
        loadingPromisesRef.current.delete(asteroidId);
      }
    })();

    // Store loading promise
    loadingPromisesRef.current.set(asteroidId, loadingPromise);

    return loadingPromise;
  }, [getSpectralData]);

  // Load batch spectral data
  const loadSpectralDataBatch = useCallback(async (asteroidIds: number[]): Promise<SpectralData[]> => {
    // Filter out already cached data
    const uncachedIds = asteroidIds.filter(id => !getSpectralData(id) && !isLoading(id));
    
    if (uncachedIds.length === 0) {
      // Return all cached data
      return asteroidIds.map(id => getSpectralData(id)).filter(Boolean) as SpectralData[];
    }

    // Set loading state for uncached IDs
    setCache(prevCache => {
      const newCache = { ...prevCache };
      uncachedIds.forEach(id => {
        newCache[id] = {
          data: null,
          loading: true,
          error: null,
          timestamp: Date.now()
        };
      });
      return newCache;
    });

    try {
      const response = await apiClient.getAsteroidsSpectraBatch(uncachedIds);
      const spectralDataMap = new Map<number, SpectralData>();

      // Process successful responses
      response.spectra.forEach((spectrum: any) => {
        if (spectrum.has_data && spectrum.wavelengths.length > 0) {
          const spectralData: SpectralData = {
            asteroid_id: spectrum.asteroid_id,
            wavelengths: spectrum.wavelengths,
            reflectances: spectrum.reflectances,
            normalized: spectrum.normalized
          };
          spectralDataMap.set(spectrum.asteroid_id, spectralData);
        }
      });

      // Update both local and multi-level cache
      setCache(prevCache => {
        const newCache = { ...prevCache };
        uncachedIds.forEach(id => {
          const spectralData = spectralDataMap.get(id);
          
          // Cache in multi-level cache
          if (spectralData) {
            const cacheKey = `spectral_${id}`;
            cacheService.set(cacheKey, spectralData, { promoteToL1: false }); // Batch data goes to L2
          }
          
          newCache[id] = {
            data: spectralData || null,
            loading: false,
            error: spectralData ? null : 'No spectral data available',
            timestamp: Date.now()
          };
        });
        return newCache;
      });

      // Return all requested data (cached + newly loaded)
      const allData: SpectralData[] = [];
      asteroidIds.forEach(id => {
        const cached = getSpectralData(id);
        const newData = spectralDataMap.get(id);
        if (cached) {
          allData.push(cached);
        } else if (newData) {
          allData.push(newData);
        }
      });

      return allData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load spectral data batch';
      
      // Update cache with errors
      setCache(prevCache => {
        const newCache = { ...prevCache };
        uncachedIds.forEach(id => {
          newCache[id] = {
            data: null,
            loading: false,
            error: errorMessage,
            timestamp: Date.now()
          };
        });
        return newCache;
      });

      // Return only cached data
      return asteroidIds.map(id => getSpectralData(id)).filter(Boolean) as SpectralData[];
    }
  }, [getSpectralData, isLoading]);

  // Prefetch spectral data with delay
  const prefetchSpectralData = useCallback((asteroidIds: number[]) => {
    // Clear existing prefetch timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    // Set new prefetch timeout
    prefetchTimeoutRef.current = setTimeout(() => {
      const uncachedIds = asteroidIds.filter(id => 
        !getSpectralData(id) && !isLoading(id)
      );

      if (uncachedIds.length > 0) {
        // Prefetch in smaller batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < uncachedIds.length; i += batchSize) {
          const batch = uncachedIds.slice(i, i + batchSize);
          loadSpectralDataBatch(batch).catch(error => {
            console.warn('Prefetch failed for batch:', batch, error);
          });
        }
      }
    }, prefetchDelay);
  }, [getSpectralData, isLoading, loadSpectralDataBatch, prefetchDelay]);

  // Clear cache
  const clearCache = useCallback(() => {
    setCache({});
    cacheHitsRef.current = 0;
    cacheMissesRef.current = 0;
    loadingPromisesRef.current.clear();
  }, []);

  // Get comprehensive cache statistics
  const getCacheStats = useCallback(() => {
    const totalRequests = cacheHitsRef.current + cacheMissesRef.current;
    const hitRate = totalRequests > 0 ? cacheHitsRef.current / totalRequests : 0;
    
    // Get multi-level cache stats
    const multiLevelStats = cacheService.getStats();
    
    return {
      local: {
        size: Object.keys(cache).length,
        hitRate: Math.round(hitRate * 100) / 100,
        hits: cacheHitsRef.current,
        misses: cacheMissesRef.current
      },
      multiLevel: multiLevelStats,
      combined: {
        totalRequests,
        overallHitRate: Math.round(hitRate * 100) / 100
      }
    };
  }, [cache]);

  // Cleanup effect
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupCache();
      enforceCacheLimit();
    }, 60000); // Cleanup every minute

    return () => {
      clearInterval(cleanupInterval);
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, [cleanupCache, enforceCacheLimit]);

  return {
    getSpectralData,
    loadSpectralData,
    loadSpectralDataBatch,
    prefetchSpectralData,
    isLoading,
    getError,
    clearCache,
    getCacheStats
  };
};
