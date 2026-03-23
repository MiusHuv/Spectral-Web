import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient, apiUtils } from '../services/api';
import { usePaginatedAsteroidCache, PaginatedAsteroidData } from './usePaginationCache';

export interface AsteroidItem {
  id: number;
  official_number?: number;
  proper_name?: string;
  provisional_designation?: string;
  bus_demeo_class?: string;
  tholen_class?: string;
  display_name?: string;
  has_spectral_data?: boolean;
  orbital_class?: string;
  semi_major_axis?: number;
  discovery_date?: string;
}

interface PaginationState {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

interface LoadingState {
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

interface UsePaginatedAsteroidsOptions {
  pageSize?: number;
  enableCache?: boolean;
  cacheOptions?: {
    maxCacheSize?: number;
    defaultTTL?: number;
  };
  enableVirtualScrolling?: boolean;
  virtualScrollThreshold?: number;
}

interface UsePaginatedAsteroidsReturn {
  // Data
  data: PaginatedAsteroidData | null;
  asteroids: AsteroidItem[];
  allLoadedAsteroids: AsteroidItem[];
  
  // Pagination state
  pagination: PaginationState;
  
  // Loading state
  loading: LoadingState;
  
  // Actions
  loadPage: (page: number) => Promise<PaginatedAsteroidData | null>;
  loadMore: () => Promise<PaginatedAsteroidData | null>;
  loadAll: () => Promise<void>;
  reset: () => void;
  
  // Cache management
  clearCache: () => void;
  getCacheStats: () => {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
  };
  
  // Virtual scrolling support
  shouldUseVirtualScrolling: boolean;
  getVirtualScrollProps: () => {
    items: AsteroidItem[];
    itemHeight: number;
    containerHeight: number;
  };
}

export const usePaginatedAsteroids = (
  system: 'bus_demeo' | 'tholen',
  classificationName: string,
  options: UsePaginatedAsteroidsOptions = {}
): UsePaginatedAsteroidsReturn => {
  const {
    pageSize = 100,
    enableCache = true,
    cacheOptions = {},
    enableVirtualScrolling = true,
    virtualScrollThreshold = 200
  } = options;

  // State
  const [asteroids, setAsteroids] = useState<AsteroidItem[]>([]);
  const [allLoadedAsteroids, setAllLoadedAsteroids] = useState<AsteroidItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 0,
    pageSize,
    total: 0,
    totalPages: 0,
    hasMore: false,
    hasPrevious: false
  });
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: false,
    isLoadingMore: false,
    error: null
  });

  // Cache
  const cacheApi = usePaginatedAsteroidCache(enableCache ? cacheOptions : { maxCacheSize: 0 });
  const {
    getPage: getCachedPage,
    setPage: setCachedPage,
    clearClassification: clearClassificationCache,
    getStats: getCacheStatsInternal
  } = cacheApi;
  
  // Track loaded pages to avoid duplicates
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when system or classification changes
  useEffect(() => {
    reset();
  }, [system, classificationName]);

  // Load a specific page
  const loadPage = useCallback(async (page: number): Promise<PaginatedAsteroidData | null> => {
    if (page < 1) return null;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(prev => ({
      ...prev,
      isLoading: page === 1,
      isLoadingMore: page > 1,
      error: null
    }));

    let pageData: PaginatedAsteroidData | null = null;

    try {
      // Check cache first
      
      if (enableCache) {
        pageData = getCachedPage(system, classificationName, page, pageSize);
      }

      // Load from API if not in cache
      if (!pageData) {
        const response = await apiUtils.withRetry(() =>
          apiClient.getClassificationAsteroidsPage(system, classificationName, page, pageSize)
        );

        pageData = {
          asteroids: response.asteroids,
          pagination: response.pagination
        };

        // Cache the result
        if (enableCache) {
          setCachedPage(system, classificationName, page, pageData, pageSize);
        }
      }

      // Update state only if we have data
      if (!pageData) {
        return null;
      }

      const normalizeAsteroid = (asteroid: AsteroidItem): AsteroidItem => {
        const semiMajorAxisRaw = (asteroid as any).semi_major_axis;
        let semiMajorAxis: number | undefined;

        if (typeof semiMajorAxisRaw === 'number' && Number.isFinite(semiMajorAxisRaw)) {
          semiMajorAxis = semiMajorAxisRaw;
        } else if (typeof semiMajorAxisRaw === 'string') {
          const parsed = Number(semiMajorAxisRaw);
          if (Number.isFinite(parsed)) {
            semiMajorAxis = parsed;
          }
        }

        return {
          ...asteroid,
          orbital_class:
            asteroid.orbital_class ??
            (asteroid as any).orbitalClass ??
            undefined,
          semi_major_axis: semiMajorAxis
        };
      };

      const { asteroids: pageAsteroids, pagination: pagePagination } = pageData;
      const normalizedAsteroids = pageAsteroids.map(normalizeAsteroid);

      if (page === 1) {
        // First page - replace all data
        setAsteroids(normalizedAsteroids);
        setAllLoadedAsteroids(normalizedAsteroids);
        loadedPagesRef.current.clear();
        loadedPagesRef.current.add(1);
      } else {
        // Additional page - append data
        if (!loadedPagesRef.current.has(page)) {
          setAllLoadedAsteroids(prev => [...prev, ...normalizedAsteroids]);
          loadedPagesRef.current.add(page);
        }
        
        // For current page view, show only this page's data
        setAsteroids(normalizedAsteroids);
      }

      setPagination({
        currentPage: page,
        pageSize: pagePagination.pageSize,
        total: pagePagination.total,
        totalPages: pagePagination.totalPages,
        hasMore: pagePagination.hasMore,
        hasPrevious: pagePagination.hasPrevious
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // Request was cancelled
      }

      const errorMessage = apiUtils.getErrorMessage(error);
      setLoading(prev => ({
        ...prev,
        error: errorMessage
      }));
      
      console.error('Failed to load page:', error);
      pageData = null;
    } finally {
      setLoading(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false
      }));
    }

    return pageData;
  }, [system, classificationName, pageSize, enableCache, getCachedPage, setCachedPage]);

  // Load more (next page)
  const loadMore = useCallback(async (): Promise<PaginatedAsteroidData | null> => {
    if (!pagination.hasMore || loading.isLoadingMore) return null;
    
    const nextPage = pagination.currentPage + 1;
    return loadPage(nextPage);
  }, [pagination.hasMore, pagination.currentPage, loading.isLoadingMore, loadPage]);

  // Load all pages (for bulk operations)
  const loadAll = useCallback(async (): Promise<void> => {
    if (pagination.totalPages === 0) {
      // Load first page to get total count
      await loadPage(1);
    }

    // Load remaining pages
    const promises: Promise<PaginatedAsteroidData | null>[] = [];
    for (let page = 2; page <= pagination.totalPages; page++) {
      if (!loadedPagesRef.current.has(page)) {
        promises.push(loadPage(page));
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }, [pagination.totalPages, loadPage]);

  // Reset state
  const reset = useCallback((): void => {
    setAsteroids([]);
    setAllLoadedAsteroids([]);
    setPagination({
      currentPage: 0,
      pageSize,
      total: 0,
      totalPages: 0,
      hasMore: false,
      hasPrevious: false
    });
    setLoading({
      isLoading: false,
      isLoadingMore: false,
      error: null
    });
    loadedPagesRef.current.clear();
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [pageSize]);

  // Clear cache
  const clearCache = useCallback((): void => {
    clearClassificationCache(system, classificationName);
  }, [clearClassificationCache, system, classificationName]);

  // Get cache stats
  const getCacheStats = useCallback(() => {
    return getCacheStatsInternal();
  }, [getCacheStatsInternal]);

  // Virtual scrolling support
  const shouldUseVirtualScrolling = enableVirtualScrolling && 
    allLoadedAsteroids.length > virtualScrollThreshold;

  const getVirtualScrollProps = useCallback(() => {
    return {
      items: allLoadedAsteroids,
      itemHeight: 60, // Standard asteroid item height
      containerHeight: Math.min(400, allLoadedAsteroids.length * 60)
    };
  }, [allLoadedAsteroids]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    data: pagination.currentPage > 0 ? {
      asteroids,
      pagination: {
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasMore: pagination.hasMore,
        hasPrevious: pagination.hasPrevious
      }
    } : null,
    asteroids,
    allLoadedAsteroids,
    
    // Pagination state
    pagination,
    
    // Loading state
    loading,
    
    // Actions
    loadPage,
    loadMore,
    loadAll,
    reset,
    
    // Cache management
    clearCache,
    getCacheStats,
    
    // Virtual scrolling support
    shouldUseVirtualScrolling,
    getVirtualScrollProps
  };
};

// Hook for managing multiple paginated classifications
export interface ClassificationPaginationState {
  [classificationName: string]: {
    asteroids: AsteroidItem[];
    pagination: PaginationState;
    loading: LoadingState;
  };
}

export const useMultipleClassificationPagination = (
  system: 'bus_demeo' | 'tholen',
  classificationNames: string[],
  options: UsePaginatedAsteroidsOptions = {}
) => {
  const [state, setState] = useState<ClassificationPaginationState>({});
  
  // Create individual hooks for each classification
  const hooks = classificationNames.reduce((acc, name) => {
    acc[name] = usePaginatedAsteroids(system, name, options);
    return acc;
  }, {} as Record<string, UsePaginatedAsteroidsReturn>);

  // Update state when individual hooks change
  useEffect(() => {
    const newState: ClassificationPaginationState = {};
    
    classificationNames.forEach(name => {
      const hook = hooks[name];
      newState[name] = {
        asteroids: hook.allLoadedAsteroids,
        pagination: hook.pagination,
        loading: hook.loading
      };
    });
    
    setState(newState);
  }, [classificationNames, hooks]);

  // Bulk operations
  const loadAllClassifications = useCallback(async (page: number = 1): Promise<void> => {
    const promises = classificationNames.map(name => hooks[name].loadPage(page));
    await Promise.all(promises);
  }, [classificationNames, hooks]);

  const clearAllCaches = useCallback((): void => {
    classificationNames.forEach(name => hooks[name].clearCache());
  }, [classificationNames, hooks]);

  const resetAll = useCallback((): void => {
    classificationNames.forEach(name => hooks[name].reset());
  }, [classificationNames, hooks]);

  return {
    state,
    hooks,
    loadAllClassifications,
    clearAllCaches,
    resetAll
  };
};
