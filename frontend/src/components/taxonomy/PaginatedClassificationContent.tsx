import React, { useCallback, useEffect, memo, useMemo } from 'react';
import { usePaginatedAsteroids, AsteroidItem } from '../../hooks/usePaginatedAsteroids';
import { useAppContext, useSelectionManager } from '../../context/AppContext';
import { apiClient } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import VirtualScrollList from '../common/VirtualScrollList';
import { getClassificationColor, getContrastingTextColor } from '../../utils/classificationColors';
import type { FilterState, RangeDomain } from './FilterPanel';

interface PaginatedClassificationContentProps {
  system: 'bus_demeo' | 'tholen';
  classificationName: string;
  totalCount: number;
  expanded: boolean;
  pageSize?: number;
  virtualScrollThreshold?: number;
  paginationThreshold?: number;
  selectionManager: ReturnType<typeof useSelectionManager>;
  onAsteroidSelection: (asteroidId: number, isSelected: boolean) => void;
  onBulkSelect: () => void;
  canBulkSelect: boolean;
  filters: FilterState;
  onRangeDomainChange?: (domain: RangeDomain) => void;
}

const PaginatedClassificationContent: React.FC<PaginatedClassificationContentProps> = memo(({
  system,
  classificationName,
  totalCount,
  expanded,
  pageSize = 100,
  virtualScrollThreshold = 200,
  paginationThreshold = 200,
  selectionManager,
  onAsteroidSelection,
  onBulkSelect,
  canBulkSelect,
  filters,
  onRangeDomainChange
}) => {
  const { dispatch } = useAppContext();
  const isDev = process.env.NODE_ENV !== 'production';

  const memoizedSelectionManager = useMemo(() => ({
    isAsteroidSelected: selectionManager.isAsteroidSelected,
    canSelectMore: selectionManager.canSelectMore
  }), [selectionManager.isAsteroidSelected, selectionManager.canSelectMore]);

  const usePagination = totalCount > paginationThreshold;

  const {
    asteroids,
    allLoadedAsteroids,
    pagination,
    loading,
    loadPage,
    loadMore,
    loadAll,
    reset,
    shouldUseVirtualScrolling,
    getVirtualScrollProps
  } = usePaginatedAsteroids(system, classificationName, {
    pageSize,
    enableCache: true,
    enableVirtualScrolling: true,
    virtualScrollThreshold
  });

  useEffect(() => {
    if (!expanded) {
      return;
    }

    reset();
    loadPage(1);
  }, [expanded, system, classificationName, reset, loadPage]);

  const getAsteroidDisplayName = useCallback((asteroid: AsteroidItem): string => {
    if (asteroid.display_name) {
      return asteroid.display_name;
    }
    if (asteroid.proper_name) {
      return asteroid.proper_name;
    }
    if (asteroid.official_number) {
      return `(${asteroid.official_number})`;
    }
    if (asteroid.provisional_designation) {
      return asteroid.provisional_designation;
    }
    return `Asteroid ${asteroid.id}`;
  }, []);

  const getAsteroidClassification = useCallback((asteroid: AsteroidItem): string => {
    if (system === 'bus_demeo') {
      return asteroid.bus_demeo_class || 'Unknown';
    }
    return asteroid.tholen_class || 'Unknown';
  }, [system]);

  const handleAsteroidSelection = useCallback(async (asteroidId: number, isSelected: boolean) => {
    onAsteroidSelection(asteroidId, isSelected);

    if (!isSelected) {
      return;
    }

    try {
      const asteroidResponse = await apiClient.getAsteroid(asteroidId);
      const asteroid = asteroidResponse?.asteroid ?? asteroidResponse;

      if (!asteroid) {
        console.warn('Asteroid payload missing for id', asteroidId, asteroidResponse);
        return;
      }

      const asteroidKey = asteroid.id ?? asteroidId;

      console.groupCollapsed('[PaginatedClassificationContent] asteroid fetch');
      console.log('requestId', asteroidId);
      console.log('resolvedId', asteroidKey);
      console.log('payloadKeys', Object.keys(asteroid));
      console.log('hasSpectralFlag', asteroid.has_spectral_data, asteroid.hasSpectralData);
      console.log('rawResponse', asteroidResponse);
      console.groupEnd();

      dispatch({
        type: 'SET_ASTEROID_DATA',
        payload: { id: asteroidKey, data: asteroid }
      });

      try {
        const spectrumResponse = await apiClient.getSpectrum(asteroidKey);
        const spectrum = spectrumResponse?.spectrum ?? spectrumResponse;

        console.groupCollapsed('[PaginatedClassificationContent] spectrum fetch');
        console.log('requestId', asteroidKey);
        console.log('rawResponse', spectrumResponse);
        console.log('keys', spectrum ? Object.keys(spectrum) : []);
        console.log('wavelengthStats', {
          isArray: Array.isArray(spectrum?.wavelengths),
          length: spectrum?.wavelengths?.length,
          sample: spectrum?.wavelengths?.slice?.(0, 5)
        });
        console.log('reflectanceStats', {
          isArray: Array.isArray(spectrum?.reflectances),
          length: spectrum?.reflectances?.length,
          sample: spectrum?.reflectances?.slice?.(0, 5)
        });
        console.groupEnd();

        if (spectrum && spectrum.wavelengths && spectrum.reflectances) {
          const spectrumKey = spectrum.asteroid_id ?? asteroidKey;

          const spectralData = {
            asteroid_id: spectrumKey,
            wavelengths: Array.isArray(spectrum.wavelengths) ? spectrum.wavelengths : [],
            reflectances: Array.isArray(spectrum.reflectances) ? spectrum.reflectances : [],
            normalized: spectrum.normalized ?? false
          };

          dispatch({
            type: 'SET_SPECTRAL_DATA',
            payload: {
              id: spectrumKey,
              data: spectralData
            }
          });

          console.log('Loaded spectral data for asteroid', asteroidKey, {
            wavelengthsCount: spectralData.wavelengths.length,
            reflectancesCount: spectralData.reflectances.length,
            normalized: spectralData.normalized
          });
        } else {
          console.warn('Invalid spectrum data structure for asteroid', asteroidKey, spectrumResponse);
        }
      } catch (spectralError) {
        console.warn('No spectral data available for asteroid', asteroidKey, spectralError);
      }
    } catch (error) {
      console.error('Failed to fetch asteroid data:', error);
    }
  }, [onAsteroidSelection, dispatch]);

  const handleBulkSelect = useCallback(async () => {
    try {
      if (usePagination && allLoadedAsteroids.length < totalCount) {
        console.log('Loading all pages for bulk selection...');
        await loadAll();
        console.log('All pages loaded, proceeding with bulk selection');
      }
      onBulkSelect();
    } catch (error) {
      console.error('Error during bulk selection:', error);
    }
  }, [usePagination, allLoadedAsteroids.length, totalCount, loadAll, onBulkSelect]);

  const renderAsteroidItem = useCallback((asteroid: AsteroidItem) => {
    const isSelected = memoizedSelectionManager.isAsteroidSelected(asteroid.id);
    const canSelect = memoizedSelectionManager.canSelectMore || isSelected;
    const classification = getAsteroidClassification(asteroid);
    const classificationColor = getClassificationColor(classification, system);
    const semiMajorAxis = (() => {
      if (typeof asteroid.semi_major_axis === 'number') {
        return asteroid.semi_major_axis;
      }
      if (typeof asteroid.semi_major_axis === 'string') {
        const parsed = Number(asteroid.semi_major_axis);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    })();
    const tooltipDetails = [
      getAsteroidDisplayName(asteroid),
      asteroid.id ? `ID: ${asteroid.id}` : null,
      asteroid.official_number ? `Number: ${asteroid.official_number}` : null,
      asteroid.provisional_designation ? `Designation: ${asteroid.provisional_designation}` : null,
      `Class: ${classification}`,
      semiMajorAxis !== undefined ? `Semi-major axis: ${semiMajorAxis.toFixed(2)} AU` : null,
      asteroid.orbital_class ? `Orbit: ${asteroid.orbital_class}` : null,
      asteroid.discovery_date ? `Discovered: ${asteroid.discovery_date}` : null
    ]
      .filter(Boolean)
      .join('\n');

    return (
      <div
        className={`asteroid-item ${isSelected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`}
        title={tooltipDetails}
        aria-label={tooltipDetails}
      >
        <label className="asteroid-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleAsteroidSelection(asteroid.id, e.target.checked)}
            disabled={!canSelect && !isSelected}
            aria-label={`Select ${getAsteroidDisplayName(asteroid)}`}
          />
          <span className="checkmark"></span>
        </label>

        <div className="asteroid-info">
          <span className="asteroid-name">
            {getAsteroidDisplayName(asteroid)}
          </span>
          <span
            className="asteroid-class"
            style={{
              backgroundColor: classificationColor,
              color: getContrastingTextColor(classificationColor)
            }}
          >
            {classification}
          </span>
          {asteroid.has_spectral_data && (
            <span className="spectral-indicator" title="Has spectral data">
              📊
            </span>
          )}
        </div>
      </div>
    );
  }, [memoizedSelectionManager, handleAsteroidSelection, getAsteroidDisplayName, getAsteroidClassification, system]);

  const renderLoadMore = useCallback(() => {
    if (loading.isLoadingMore) {
      return (
        <div className="load-more-loading">
          <LoadingSpinner message="Loading more asteroids..." />
        </div>
      );
    }

    if (pagination.hasMore) {
      return (
        <button
          className="load-more-btn"
          onClick={loadMore}
          disabled={loading.isLoadingMore}
        >
          Load More ({pagination.total - allLoadedAsteroids.length} remaining)
        </button>
      );
    }

    return null;
  }, [loading.isLoadingMore, pagination.hasMore, pagination.total, allLoadedAsteroids.length, loadMore]);

  const displayAsteroids = useMemo(() => (
    usePagination ? allLoadedAsteroids : asteroids
  ), [usePagination, allLoadedAsteroids, asteroids]);

  const computedDomain = useMemo<RangeDomain>(() => {
    const values = displayAsteroids
      .map((asteroid) => {
        const raw = asteroid.semi_major_axis;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          return raw;
        }
        if (typeof raw === 'string') {
          const parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      })
      .filter((value): value is number => value !== undefined);

    if (!values.length) {
      return { min: 0, max: 10 };
    }

    const min = Math.floor(Math.min(...values) * 100) / 100;
    const rawMax = Math.ceil(Math.max(...values) * 100) / 100;
    const max = rawMax === min ? min + 1 : rawMax;

    return { min, max };
  }, [displayAsteroids]);

  useEffect(() => {
    if (!onRangeDomainChange) {
      return;
    }
    onRangeDomainChange(computedDomain);
  }, [onRangeDomainChange, computedDomain.min, computedDomain.max]);

  const normalizedFilters = useMemo(() => {
    const rawQuery = (filters.query ?? '').trim();
    const query = rawQuery.toLowerCase();
    const orbitalClass = filters.orbitalClass ?? '';
    const orbitalClassUpper = orbitalClass.toUpperCase();

    const rawMin = Number.isFinite(filters.aMin) ? filters.aMin : computedDomain.min;
    const rawMax = Number.isFinite(filters.aMax) ? filters.aMax : computedDomain.max;
    const safeMin = Math.min(rawMin, rawMax);
    const safeMax = Math.max(rawMin, rawMax);

    return {
      rawQuery,
      query,
      orbitalClass,
      orbitalClassUpper,
      aMin: safeMin,
      aMax: safeMax
    };
  }, [filters, computedDomain.min, computedDomain.max]);

  const filteredAsteroids = useMemo(() => {
    if (
      !normalizedFilters.query &&
      !normalizedFilters.orbitalClass &&
      normalizedFilters.aMin <= computedDomain.min &&
      normalizedFilters.aMax >= computedDomain.max
    ) {
      return displayAsteroids;
    }

    return displayAsteroids.filter((asteroid) => {
      if (normalizedFilters.query) {
        const searchLower = normalizedFilters.query;
        const displayName = getAsteroidDisplayName(asteroid).toLowerCase();
        const idString = String(asteroid.id ?? '');
        const officialNumber = asteroid.official_number ? String(asteroid.official_number) : '';
        const provisionalDesignation = asteroid.provisional_designation?.toLowerCase() ?? '';

        const matchesSearch =
          displayName.includes(searchLower) ||
          idString.includes(searchLower) ||
          officialNumber.includes(searchLower) ||
          provisionalDesignation.includes(searchLower);

        if (!matchesSearch) {
          return false;
        }
      }

      if (normalizedFilters.orbitalClass) {
        const orbital =
          asteroid.orbital_class ??
          (asteroid as any).orbitalClass ??
          '';
        if ((orbital ?? '').toUpperCase() !== normalizedFilters.orbitalClassUpper) {
          return false;
        }
      }

      const semiMajorAxis = (() => {
        if (typeof asteroid.semi_major_axis === 'number') {
          return asteroid.semi_major_axis;
        }
        if (typeof asteroid.semi_major_axis === 'string') {
          const parsed = Number(asteroid.semi_major_axis);
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      })();

      if (semiMajorAxis === undefined) {
        if (
          normalizedFilters.aMin > computedDomain.min ||
          normalizedFilters.aMax < computedDomain.max
        ) {
          return false;
        }
        return true;
      }

      if (semiMajorAxis < normalizedFilters.aMin || semiMajorAxis > normalizedFilters.aMax) {
        return false;
      }

      return true;
    });
  }, [
    displayAsteroids,
    normalizedFilters,
    computedDomain.min,
    computedDomain.max,
    getAsteroidDisplayName
  ]);

  const virtualScrollProps = useMemo(() => getVirtualScrollProps(), [getVirtualScrollProps]);

  const hasActiveFilters = useMemo(() => (
    normalizedFilters.rawQuery !== '' ||
    normalizedFilters.orbitalClass !== '' ||
    normalizedFilters.aMin > computedDomain.min ||
    normalizedFilters.aMax < computedDomain.max
  ), [normalizedFilters, computedDomain.min, computedDomain.max]);

  useEffect(() => {
    if (!isDev) {
      return;
    }

    console.groupCollapsed('[PaginatedClassificationContent] snapshot');
    console.log('system', system);
    console.log('classification', classificationName);
    console.log('expanded', expanded);
    console.log('totalCount', totalCount);
    console.log('usePagination', usePagination);
    console.log('domain', computedDomain);
    console.log('filters', normalizedFilters);
    console.log('pagination', pagination);
    console.log('loading', loading);
    console.log('available', displayAsteroids.length);
    console.log('filtered', filteredAsteroids.length);
    console.groupEnd();
  }, [
    isDev,
    system,
    classificationName,
    expanded,
    totalCount,
    usePagination,
    computedDomain,
    normalizedFilters,
    pagination,
    loading,
    displayAsteroids.length,
    filteredAsteroids.length
  ]);

  if (!expanded) {
    return null;
  }

  if (loading.isLoading && displayAsteroids.length === 0) {
    return (
      <div className="classification-loading">
        <LoadingSpinner message={`Loading ${classificationName} asteroids...`} />
      </div>
    );
  }

  if (loading.error) {
    return (
      <div className="classification-error">
        <ErrorMessage message={loading.error} />
        <button
          className="retry-btn"
          onClick={() => loadPage(1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (
    displayAsteroids.length === 0 &&
    !loading.isLoading &&
    !hasActiveFilters
  ) {
    return (
      <div className="no-asteroids">
        No asteroids found in this classification.
      </div>
    );
  }

  return (
    <div className="asteroids-list">
      <div className="classification-controls">
        <button
          className="bulk-select-btn"
          onClick={handleBulkSelect}
          disabled={!canBulkSelect || loading.isLoading}
          title={`Select all ${totalCount} asteroids in this classification`}
        >
          {loading.isLoading ? 'Loading...' : `Select All (${totalCount})`}
        </button>

        {usePagination && (
          <div className="pagination-info">
            <span>
              Showing {allLoadedAsteroids.length} of {totalCount} asteroids
            </span>
            {pagination.hasMore && (
              <button
                className="load-all-btn"
                onClick={loadAll}
                disabled={loading.isLoadingMore}
              >
                Load All
              </button>
            )}
          </div>
        )}
      </div>

      {filteredAsteroids.length === 0 ? (
        <div className="no-asteroids">
          No asteroids match the current filters.
        </div>
      ) : shouldUseVirtualScrolling ? (
        <VirtualScrollList
          {...virtualScrollProps}
          items={filteredAsteroids}
          renderItem={renderAsteroidItem}
          className="virtual-asteroids-list"
          overscan={10}
          hasMore={usePagination ? pagination.hasMore : false}
          isLoadingMore={loading.isLoadingMore}
          onLoadMore={usePagination ? loadMore : undefined}
          loadMoreThreshold={100}
          renderLoadMore={renderLoadMore}
        />
      ) : (
        <div className="asteroids-grid">
          {filteredAsteroids.map((asteroid) => (
            <div key={asteroid.id}>
              {renderAsteroidItem(asteroid)}
            </div>
          ))}

          {usePagination && pagination.hasMore && (
            <div className="load-more-container">
              {renderLoadMore()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PaginatedClassificationContent.displayName = 'PaginatedClassificationContent';

export default PaginatedClassificationContent;
