import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface RangeDomain {
  min: number;
  max: number;
}

export interface FilterState {
  query: string;
  orbitalClass: string;
  aMin: number;
  aMax: number;
}

export const DEFAULT_ORBITAL_CLASS_OPTIONS: string[] = [
  '',
  'NEO',
  'MBA',
  'TNO',
  'CEN',
  'COM',
  'IEO',
  'AMO',
  'APO',
  'HYP'
];

interface FilterPanelProps {
  domain?: RangeDomain;
  value: FilterState;
  onChange: (next: FilterState) => void;
  className?: string;
  orbitalClassOptions?: string[];
  debounceMs?: number;
}

const FALLBACK_DOMAIN: RangeDomain = { min: 0, max: 10 };

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const areValuesEqual = (a: FilterState, b: FilterState) =>
  a.query === b.query &&
  a.orbitalClass === b.orbitalClass &&
  a.aMin === b.aMin &&
  a.aMax === b.aMax;

const FilterPanel: React.FC<FilterPanelProps> = ({
  domain,
  value,
  onChange,
  className,
  orbitalClassOptions = DEFAULT_ORBITAL_CLASS_OPTIONS,
  debounceMs = 200
}) => {
  const resolvedDomain = useMemo<RangeDomain>(() => {
    const incomingMin = Number.isFinite(domain?.min) ? Number(domain?.min) : FALLBACK_DOMAIN.min;
    const incomingMax = Number.isFinite(domain?.max) ? Number(domain?.max) : FALLBACK_DOMAIN.max;
    if (incomingMax <= incomingMin) {
      return {
        min: incomingMin,
        max: incomingMin + 1
      };
    }
    return {
      min: incomingMin,
      max: incomingMax
    };
  }, [domain?.min, domain?.max]);

  const [localQuery, setLocalQuery] = useState(() => value.query ?? '');
  const [localMin, setLocalMin] = useState(() =>
    clamp(value.aMin ?? resolvedDomain.min, resolvedDomain.min, resolvedDomain.max)
  );
  const [localMax, setLocalMax] = useState(() =>
    clamp(value.aMax ?? resolvedDomain.max, resolvedDomain.min, resolvedDomain.max)
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Sync local state when external value changes
  useEffect(() => {
    if (value.query !== localQuery) {
      setLocalQuery(value.query ?? '');
    }

    const nextMin = clamp(value.aMin ?? resolvedDomain.min, resolvedDomain.min, resolvedDomain.max);
    if (nextMin !== localMin) {
      setLocalMin(nextMin);
    }

    const nextMax = clamp(value.aMax ?? resolvedDomain.max, resolvedDomain.min, resolvedDomain.max);
    if (nextMax !== localMax) {
      setLocalMax(nextMax);
    }
  }, [
    value.query,
    value.aMin,
    value.aMax,
    resolvedDomain.min,
    resolvedDomain.max,
    localQuery,
    localMin,
    localMax
  ]);

  // Enhanced debounced query emission with visual feedback
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set searching state when user types
    if (localQuery !== value.query) {
      setIsSearching(true);
    }

    // Set new timer for debounced emission
    const handle = setTimeout(() => {
      const trimmed = localQuery.trim();
      if (trimmed === value.query) {
        setIsSearching(false);
        return;
      }

      const next: FilterState = {
        ...value,
        query: trimmed
      };

      if (!areValuesEqual(value, next)) {
        onChange(next);
      }

      setIsSearching(false);
    }, debounceMs);

    debounceTimerRef.current = handle;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [localQuery, debounceMs, onChange, value]);

  const emitChange = useCallback(
    (patch: Partial<FilterState>) => {
      const next: FilterState = {
        ...value,
        ...patch
      };

      const clampedMin = clamp(next.aMin ?? resolvedDomain.min, resolvedDomain.min, resolvedDomain.max);
      const clampedMax = clamp(next.aMax ?? resolvedDomain.max, resolvedDomain.min, resolvedDomain.max);
      const safeMin = Math.min(clampedMin, clampedMax);
      const safeMax = Math.max(clampedMin, clampedMax);

      const normalized: FilterState = {
        query: next.query ?? '',
        orbitalClass: next.orbitalClass ?? '',
        aMin: safeMin,
        aMax: safeMax
      };

      if (!areValuesEqual(value, normalized)) {
        onChange(normalized);
      }
    },
    [onChange, value, resolvedDomain.min, resolvedDomain.max]
  );

  const handleOrbitalClassChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      emitChange({ orbitalClass: event.target.value });
    },
    [emitChange]
  );

  const handleMinChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(event.target.value);
      const clampedValue = clamp(raw, resolvedDomain.min, resolvedDomain.max);
      const safeValue = Math.min(clampedValue, localMax);
      setLocalMin(safeValue);
      emitChange({ aMin: safeValue });
    },
    [emitChange, localMax, resolvedDomain.min, resolvedDomain.max]
  );

  const handleMaxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(event.target.value);
      const clampedValue = clamp(raw, resolvedDomain.min, resolvedDomain.max);
      const safeValue = Math.max(clampedValue, localMin);
      setLocalMax(safeValue);
      emitChange({ aMax: safeValue });
    },
    [emitChange, localMin, resolvedDomain.min, resolvedDomain.max]
  );

  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(event.target.value);
  }, []);

  const handleClearQuery = useCallback(() => {
    setLocalQuery('');
  }, []);

  const handleReset = useCallback(() => {
    setLocalQuery('');
    setLocalMin(resolvedDomain.min);
    setLocalMax(resolvedDomain.max);
    emitChange({
      query: '',
      orbitalClass: '',
      aMin: resolvedDomain.min,
      aMax: resolvedDomain.max
    });
  }, [emitChange, resolvedDomain.min, resolvedDomain.max]);

  const trackStyle = useMemo(
    () =>
      ({
        '--range-min': resolvedDomain.min,
        '--range-max': resolvedDomain.max,
        '--left': localMin,
        '--right': localMax
      }) as React.CSSProperties,
    [resolvedDomain.min, resolvedDomain.max, localMin, localMax]
  );

  return (
    <div className={`filter-panel ${className ?? ''}`.trim()}>
      <div className="filter-grid">
        <div className="search-input-container">
          <input
            type="text"
            className={`search-input ${isSearching ? 'searching' : ''}`}
            placeholder="Search by name, ID, or designation..."
            value={localQuery}
            onChange={handleQueryChange}
            aria-label="Search asteroids"
          />
          {isSearching && (
            <div className="search-spinner" aria-label="Searching...">
              <div className="spinner"></div>
            </div>
          )}
          {localQuery && !isSearching && (
            <button
              className="clear-search-btn"
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="orbital-class-filter">Orbital Class</label>
          <select
            id="orbital-class-filter"
            className="orbital-class-filter"
            value={value.orbitalClass}
            onChange={handleOrbitalClassChange}
          >
            {orbitalClassOptions.map((option) => (
              <option key={option || 'all'} value={option}>
                {option ? option : 'All Classes'}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group range-filter">
          <div className="range-labels">
            <span>Semi-Major Axis (AU)</span>
            <span className="range-values">
              {localMin.toFixed(2)} — {localMax.toFixed(2)}
            </span>
          </div>
          <div className="dual-range">
            <input
              type="range"
              min={resolvedDomain.min}
              max={resolvedDomain.max}
              step={0.01}
              value={localMin}
              onChange={handleMinChange}
              aria-label="Minimum semi-major axis"
            />
            <input
              type="range"
              min={resolvedDomain.min}
              max={resolvedDomain.max}
              step={0.01}
              value={localMax}
              onChange={handleMaxChange}
              aria-label="Maximum semi-major axis"
            />
            <div className="dual-range-track" style={trackStyle} />
          </div>
        </div>

        <button
          className="clear-filters-btn"
          type="button"
          onClick={handleReset}
          aria-label="Reset filters"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
