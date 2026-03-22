import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useAppContext, useSelectionManager } from '../../context/AppContext';
import { apiClient, apiUtils } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import PaginatedClassificationContent from './PaginatedClassificationContent';
import FilterPanel, { FilterState, RangeDomain } from './FilterPanel';
import { getClassificationColor, getClassificationBackgroundColor, getContrastingTextColor } from '../../utils/classificationColors';
import './TaxonomyTree.css';

// Search and filter state interface
interface ClassificationMetadata {
  name: string;
  total_count: number;
  spectral_count: number;
  spectral_percentage: number;
}

interface ClassificationNode {
  name: string;
  metadata: ClassificationMetadata;
  expanded: boolean;
}

interface TaxonomyTreeProps {
  maxSelections?: number;
  virtualScrollThreshold?: number;
  enablePagination?: boolean;
  pageSize?: number;
  paginationThreshold?: number; // Number of asteroids above which to use pagination
}

const TaxonomyTree: React.FC<TaxonomyTreeProps> = memo(({
  maxSelections = 10,
  virtualScrollThreshold = 50,
  enablePagination = true,
  pageSize = 100,
  paginationThreshold = 200
}) => {
  const { state, dispatch } = useAppContext();
  const selectionManager = useSelectionManager(maxSelections);
  const isDev = process.env.NODE_ENV !== 'production';
  const {
    selectionCount,
    maxSelections: selectionLimit,
    remainingSelections,
    hasSelections
  } = selectionManager;

  const selectionProgress = useMemo(() => {
    if (!selectionLimit || selectionLimit <= 0) {
      return { value: 0, percent: 0 };
    }

    const value = Math.min((selectionCount / selectionLimit) * 100, 100);
    return {
      value,
      percent: Math.round(value)
    };
  }, [selectionCount, selectionLimit]);

  const [classifications, setClassifications] = useState<ClassificationNode[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    query: '',
    orbitalClass: '',
    aMin: 0,
    aMax: 10
  });
  const [rangeDomain, setRangeDomain] = useState<RangeDomain>({ min: 0, max: 10 });

  // Load classification metadata (progressive loading step 1)
  const loadClassificationMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setError(null);

    try {
      console.log('Loading classification metadata for system:', state.classificationSystem);
      const response = await apiUtils.withRetry(() =>
        apiClient.getClassificationMetadata(state.classificationSystem)
      );

      console.log('Classification metadata received:', response);

      const classificationNodes: ClassificationNode[] = response.classes.map((cls: any) => ({
        name: cls.name,
        metadata: {
          name: cls.name,
          total_count: cls.total_count,
          spectral_count: cls.spectral_count,
          spectral_percentage: cls.spectral_percentage
        },
        expanded: false
      }));

      console.log('Processed classification metadata nodes:', classificationNodes);
      setClassifications(classificationNodes);
    } catch (err) {
      console.error('Metadata API call failed:', err);
      setError(`Failed to load classification metadata: ${apiUtils.getErrorMessage(err)}`);
      setClassifications([]);
    } finally {
      setMetadataLoading(false);
    }
  }, [state.classificationSystem]);



  // Load metadata when component mounts or classification system changes
  useEffect(() => {
    loadClassificationMetadata();
  }, [loadClassificationMetadata]);

  // Toggle classification expansion
  const toggleClassification = useCallback((classificationName: string) => {
    console.log('Toggling classification:', classificationName);
    
    setClassifications(prev =>
      prev.map(cls => {
        if (cls.name === classificationName) {
          return { ...cls, expanded: !cls.expanded };
        }
        return cls;
      })
    );
  }, []);

  // Handle asteroid selection - memoize selectionManager to prevent unnecessary re-renders
  const memoizedSelectionManager = useMemo(() => ({
    selectAsteroid: selectionManager.selectAsteroid,
    deselectAsteroid: selectionManager.deselectAsteroid,
    isAsteroidSelected: selectionManager.isAsteroidSelected,
    canSelectMore: selectionManager.canSelectMore,
    selectionCount: selectionManager.selectionCount,
    maxSelections: selectionManager.maxSelections,
    remainingSelections: selectionManager.remainingSelections,
    hasSelections: selectionManager.hasSelections,
    clearAllSelections: selectionManager.clearAllSelections
  }), [selectionManager.selectAsteroid, selectionManager.deselectAsteroid, selectionManager.isAsteroidSelected, selectionManager.canSelectMore, selectionManager.selectionCount, selectionManager.maxSelections, selectionManager.remainingSelections, selectionManager.hasSelections, selectionManager.clearAllSelections]);

  const handleAsteroidSelection = useCallback((asteroidId: number, isSelected: boolean) => {
    console.log('Asteroid selection changed:', asteroidId, isSelected);

    // Handle selection logic
    const result = isSelected
      ? memoizedSelectionManager.selectAsteroid(asteroidId)
      : memoizedSelectionManager.deselectAsteroid(asteroidId);

    if (!result.success && result.error) {
      console.warn('Selection error:', result.error);
      setError(result.error);
      return;
    } else {
      console.log('Selection successful');
      if (error) setError(null);
    }
  }, [memoizedSelectionManager, error]);

  // Handle classification system change
  const handleSystemChange = (system: 'bus_demeo' | 'tholen') => {
    console.log('Classification system changed to:', system);
    dispatch({ type: 'SET_CLASSIFICATION_SYSTEM', payload: system });
  };

  // Clear all selections
  const handleClearAll = useCallback(() => {
    console.log('Clearing all selections');
    selectionManager.clearAllSelections();
    // Clear any selection-related errors
    if (error && (error.includes('Maximum') || error.includes('selected') || error.includes('Cannot select'))) {
      setError(null);
    }
  }, [selectionManager, error]);

  // Handle bulk selection for a classification
  const handleClassificationBulkSelect = useCallback(() => {
    // This will be handled by the PaginatedClassificationContent component
    // Just clear any selection-related errors
    if (error && (error.includes('Maximum') || error.includes('selected'))) {
      setError(null);
    }
  }, [error]);



  const handleFiltersChange = useCallback((next: FilterState) => {
    setFilters((prev) => {
      if (
        prev.query === next.query &&
        prev.orbitalClass === next.orbitalClass &&
        prev.aMin === next.aMin &&
        prev.aMax === next.aMax
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleRangeDomainChange = useCallback((domain: RangeDomain) => {
    setRangeDomain((prev) => {
      if (prev.min === domain.min && prev.max === domain.max) {
        return prev;
      }
      return domain;
    });
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const clampedMin = Math.min(Math.max(prev.aMin, rangeDomain.min), rangeDomain.max);
      const clampedMax = Math.min(Math.max(prev.aMax, rangeDomain.min), rangeDomain.max);
      if (clampedMin === prev.aMin && clampedMax === prev.aMax) {
        return prev;
      }
      return {
        ...prev,
        aMin: clampedMin,
        aMax: clampedMax
      };
    });
  }, [rangeDomain.min, rangeDomain.max]);

  useEffect(() => {
    if (!isDev) {
      return;
    }

    console.groupCollapsed('[TaxonomyTree] snapshot');
    console.log('system', state.classificationSystem);
    console.log('classificationCount', classifications.length);
    console.log('metadataLoading', metadataLoading);
    console.log('error', error);
    console.log('filters', filters);
    console.log('rangeDomain', rangeDomain);
    console.log('selection', {
      selectionCount,
      selectionLimit,
      remainingSelections,
      hasSelections
    });
    console.groupEnd();
  }, [
    isDev,
    state.classificationSystem,
    classifications.length,
    metadataLoading,
    error,
    filters,
    rangeDomain,
    selectionCount,
    selectionLimit,
    remainingSelections,
    hasSelections
  ]);

  // Early return for initial loading state - after all hooks are declared
  if (metadataLoading && classifications.length === 0) {
    return <LoadingSpinner message="Loading classification metadata..." />;
  }

  return (
    <div className="taxonomy-tree">
      <div className="taxonomy-header">
        <h3>Asteroid Classifications</h3>

        <FilterPanel
          domain={rangeDomain}
          value={filters}
          onChange={handleFiltersChange}
          className="taxonomy-filter-panel"
        />

        {/* Classification System Selector */}
        <div className="system-selector">
          <label htmlFor="classification-system">System:</label>
          <select
            id="classification-system"
            value={state.classificationSystem}
            onChange={(e) => handleSystemChange(e.target.value as 'bus_demeo' | 'tholen')}
            disabled={metadataLoading}
          >
            <option value="bus_demeo">Bus-DeMeo</option>
            <option value="tholen">Tholen</option>
          </select>
        </div>

        {/* Selection Info */}
        <div className="selection-info">
          <div className="selection-status">
            <div className="selection-count-display">
              <span className="selection-count">
                {selectionCount} of {selectionLimit} selected
              </span>
              <span className="remaining-count">
                {remainingSelections} remaining
              </span>
            </div>
            <div
              className="selection-progress"
              role="progressbar"
              aria-valuenow={selectionCount}
              aria-valuemin={0}
              aria-valuemax={Math.max(selectionLimit, 1)}
              aria-label={`Selected ${selectionCount} of ${selectionLimit} asteroids`}
            >
              <div className="selection-progress-bar">
                <div
                  className="selection-progress-bar-fill"
                  style={{ width: `${selectionProgress.value}%` }}
                />
              </div>
              <span className="selection-progress-text">
                {selectionProgress.percent}%
              </span>
            </div>
          </div>
          {hasSelections && (
            <button
              className="clear-all-btn"
              onClick={handleClearAll}
              type="button"
              aria-label="Clear all selected asteroids"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {metadataLoading && (
        <div className="loading-overlay">
          <LoadingSpinner message="Loading classification metadata..." />
        </div>
      )}

      <div className="classifications-list custom-scrollbar">
        {classifications.length === 0 && !metadataLoading ? (
          <div className="empty-state">
            <p>No classifications found for the selected system.</p>
            <button onClick={loadClassificationMetadata} className="retry-btn">
              Retry
            </button>
          </div>
        ) : (
          classifications.map((classification) => (
            <div key={classification.name} className="classification-node">
              <div className="classification-header-container">
                <div
                  className="classification-header"
                  onClick={() => toggleClassification(classification.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleClassification(classification.name);
                    }
                  }}
                  style={{
                    backgroundColor: getClassificationBackgroundColor(classification.name, state.classificationSystem, 0.15),
                    borderColor: getClassificationColor(classification.name, state.classificationSystem),
                  }}
                >
                  <span className={`expand-icon ${classification.expanded ? 'expanded' : ''}`}>
                    ▶
                  </span>
                  <span 
                    className="classification-name"
                    style={{
                      color: getClassificationColor(classification.name, state.classificationSystem)
                    }}
                  >
                    {classification.name}
                  </span>
                  <span
                    className="classification-count"
                    style={{
                      color: getClassificationColor(classification.name, state.classificationSystem)
                    }}
                  >
                    ({classification.metadata.total_count})
                  </span>
                </div>

              </div>

              <PaginatedClassificationContent
                system={state.classificationSystem}
                classificationName={classification.name}
                totalCount={classification.metadata.total_count}
                expanded={classification.expanded}
                pageSize={pageSize}
                virtualScrollThreshold={virtualScrollThreshold}
                paginationThreshold={paginationThreshold}
                selectionManager={selectionManager}
                onAsteroidSelection={handleAsteroidSelection}
                onBulkSelect={handleClassificationBulkSelect}
                canBulkSelect={selectionManager.canSelectMore}
                filters={filters}
                onRangeDomainChange={handleRangeDomainChange}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
});

TaxonomyTree.displayName = 'TaxonomyTree';

export default TaxonomyTree;
