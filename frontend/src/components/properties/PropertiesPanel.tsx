import React, { memo, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  Asteroid,
  OrbitalElements,
  PhysicalProperties
} from '../../context/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  className?: string;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = memo(({ className = '' }) => {
  const { state, dispatch } = useAppContext();
  const {
    selectedAsteroids,
    asteroidData,
    loading,
    error,
    focusedAsteroidId
  } = state;

  const selectedAsteroidData = useMemo(
    () =>
      selectedAsteroids
        .map((id) => asteroidData[id])
        .filter((value): value is Asteroid => Boolean(value)),
    [selectedAsteroids, asteroidData]
  );

  const handleFocusChange = useCallback(
    (id: number | null) => {
      dispatch({ type: 'SET_FOCUSED_ASTEROID', payload: id });
    },
    [dispatch]
  );

  if (loading) {
    return (
      <div className={`properties-panel ${className}`}>
        <LoadingSpinner message="Loading asteroid properties..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`properties-panel ${className}`}>
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (selectedAsteroids.length === 0) {
    return (
      <div className={`properties-panel ${className}`}>
        <div className="no-selection-message">
          <h3>No Asteroids Selected</h3>
          <p>Select asteroids from the classification tree to view their properties.</p>
        </div>
      </div>
    );
  }

  if (selectedAsteroidData.length === 0) {
    return (
      <div className={`properties-panel ${className}`}>
        <div className="loading-data-message">
          <h3>Loading Asteroid Data</h3>
          <p>Asteroid property data is being loaded...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`properties-panel ${className}`}>
      <div className="properties-header">
        <h3>Asteroid Properties</h3>
        <div className="selection-count">
          {selectedAsteroidData.length} asteroid
          {selectedAsteroidData.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div className="properties-content">
        {selectedAsteroidData.length === 1 ? (
          <SingleAsteroidView asteroid={selectedAsteroidData[0]} />
        ) : (
          <MultipleAsteroidsView
            asteroids={selectedAsteroidData}
            focusedId={focusedAsteroidId}
            onFocus={handleFocusChange}
          />
        )}
      </div>
    </div>
  );
});

PropertiesPanel.displayName = 'PropertiesPanel';

interface MultipleAsteroidsViewProps {
  asteroids: Asteroid[];
  focusedId: number | null;
  onFocus: (id: number | null) => void;
}

type ComparisonRow = {
  key: string;
  label: string;
  unit?: string;
  getValue: (asteroid: Asteroid) => string | number | null | undefined;
};

const MultipleAsteroidsView: React.FC<MultipleAsteroidsViewProps> = memo(
  ({ asteroids, focusedId, onFocus }) => {
    const comparisonRows = useMemo<ComparisonRow[]>(
      () => [
        {
          key: 'designation',
          label: 'Designation',
          getValue: (asteroid) => getAsteroidDisplayName(asteroid)
        },
        {
          key: 'officialNumber',
          label: 'Official Number',
          getValue: (asteroid) => asteroid.identifiers?.official_number
        },
        {
          key: 'provisionalDesignation',
          label: 'Provisional Designation',
          getValue: (asteroid) => asteroid.identifiers?.provisional_designation
        },
        {
          key: 'orbitalClass',
          label: 'Orbital Class',
          getValue: (asteroid) => asteroid.classifications?.orbital_class
        },
        {
          key: 'semiMajorAxis',
          label: 'Semi-major Axis',
          unit: 'AU',
          getValue: (asteroid) => asteroid.orbital_elements?.semi_major_axis
        },
        {
          key: 'eccentricity',
          label: 'Eccentricity',
          getValue: (asteroid) => asteroid.orbital_elements?.eccentricity
        },
        {
          key: 'orbitalPeriod',
          label: 'Orbital Period',
          unit: 'years',
          getValue: (asteroid) => asteroid.orbital_elements?.orbital_period
        },
        {
          key: 'diameter',
          label: 'Diameter',
          unit: 'km',
          getValue: (asteroid) => asteroid.physical_properties?.diameter
        },
        {
          key: 'albedo',
          label: 'Albedo',
          getValue: (asteroid) => asteroid.physical_properties?.albedo
        },
        {
          key: 'rotationPeriod',
          label: 'Rotation Period',
          unit: 'hours',
          getValue: (asteroid) => asteroid.physical_properties?.rotation_period
        },
        {
          key: 'density',
          label: 'Density',
          unit: 'g/cm³',
          getValue: (asteroid) => asteroid.physical_properties?.density
        }
      ],
      []
    );

    const renderCellValue = (value: string | number | null | undefined, unit?: string) => {
      if (value === null || value === undefined || value === '') {
        return <span className="na-value">N/A</span>;
      }

      if (typeof value === 'number') {
        return (
          <>
            {formatNumber(value)}
            {unit ? <span className="unit"> {unit}</span> : null}
          </>
        );
      }

      return (
        <>
          {value}
          {unit ? <span className="unit"> {unit}</span> : null}
        </>
      );
    };

    const handleActivate = (asteroidId: number, isFocused: boolean) => {
      onFocus(isFocused ? null : asteroidId);
    };

    return (
      <div className="multiple-asteroids-view">
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col" className="comparison-label-col">
                  Attribute
                </th>
                {asteroids.map((asteroid) => {
                  const isFocused = focusedId === asteroid.id;
                  return (
                    <th
                      scope="col"
                      key={asteroid.id}
                      className={`comparison-col ${isFocused ? 'is-focused' : ''}`}
                    >
                      <button
                        type="button"
                        className="comparison-col-button"
                        onClick={() => handleActivate(asteroid.id, isFocused)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleActivate(asteroid.id, isFocused);
                          }
                        }}
                        aria-pressed={isFocused}
                      >
                        {getAsteroidDisplayName(asteroid)}
                      </button>
                      <span className="comparison-subtitle">ID: {asteroid.id}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="comparison-label-col">
                    {row.label}
                  </th>
                  {asteroids.map((asteroid) => {
                    const isFocused = focusedId === asteroid.id;
                    const value = row.getValue(asteroid);
                    return (
                      <td
                        key={`${row.key}-${asteroid.id}`}
                        className={`comparison-value ${isFocused ? 'is-focused' : ''}`}
                      >
                        {renderCellValue(value, row.unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

MultipleAsteroidsView.displayName = 'MultipleAsteroidsView';

const SingleAsteroidView: React.FC<{ asteroid: Asteroid }> = memo(({ asteroid }) => {
  return (
    <div className="single-asteroid-view">
      <div className="asteroid-header">
        <h4>{getAsteroidDisplayName(asteroid)}</h4>
        <div className="asteroid-id">ID: {asteroid.id}</div>
      </div>

      <div className="properties-sections">
        <IdentificationSection asteroid={asteroid} />
        <ClassificationSection asteroid={asteroid} />
        <OrbitalElementsSection orbital={asteroid.orbital_elements} />
        <PhysicalPropertiesSection physical={asteroid.physical_properties} />
      </div>
    </div>
  );
});

SingleAsteroidView.displayName = 'SingleAsteroidView';

const IdentificationSection: React.FC<{ asteroid: Asteroid; compact?: boolean }> = memo(
  ({ asteroid, compact = false }) => {
    return (
      <div className={`property-section identification-section ${compact ? 'compact' : ''}`}>
        <h5>Identification</h5>
        <div className="property-grid">
          <PropertyRow
            label="Official Number"
            value={asteroid.identifiers?.official_number}
            compact={compact}
          />
          <PropertyRow
            label="Proper Name"
            value={asteroid.identifiers?.proper_name}
            compact={compact}
          />
          <PropertyRow
            label="Provisional Designation"
            value={asteroid.identifiers?.provisional_designation}
            compact={compact}
          />
        </div>
      </div>
    );
  }
);

IdentificationSection.displayName = 'IdentificationSection';

const ClassificationSection: React.FC<{ asteroid: Asteroid; compact?: boolean }> = memo(
  ({ asteroid, compact = false }) => {
    return (
      <div className={`property-section classification-section ${compact ? 'compact' : ''}`}>
        <h5>Classification</h5>
        <div className="property-grid">
          <PropertyRow
            label="Bus-DeMeo Class"
            value={asteroid.classifications?.bus_demeo_class}
            compact={compact}
          />
          <PropertyRow
            label="Tholen Class"
            value={asteroid.classifications?.tholen_class}
            compact={compact}
          />
          <PropertyRow
            label="Orbital Class"
            value={asteroid.classifications?.orbital_class}
            compact={compact}
          />
        </div>
      </div>
    );
  }
);

ClassificationSection.displayName = 'ClassificationSection';

const OrbitalElementsSection: React.FC<{ orbital?: OrbitalElements; compact?: boolean }> = memo(
  ({ orbital, compact = false }) => {
    return (
      <div className={`property-section orbital-section ${compact ? 'compact' : ''}`}>
        <h5>Orbital Elements</h5>
        <div className="property-grid">
          <PropertyRow
            label="Semi-major Axis"
            value={orbital?.semi_major_axis}
            unit="AU"
            compact={compact}
          />
          <PropertyRow label="Eccentricity" value={orbital?.eccentricity} compact={compact} />
          <PropertyRow
            label="Inclination"
            value={orbital?.inclination}
            unit="°"
            compact={compact}
          />
          <PropertyRow
            label="Orbital Period"
            value={orbital?.orbital_period}
            unit="years"
            compact={compact}
          />
          <PropertyRow
            label="Perihelion Distance"
            value={orbital?.perihelion_distance}
            unit="AU"
            compact={compact}
          />
          <PropertyRow
            label="Aphelion Distance"
            value={orbital?.aphelion_distance}
            unit="AU"
            compact={compact}
          />
        </div>
      </div>
    );
  }
);

OrbitalElementsSection.displayName = 'OrbitalElementsSection';

const PhysicalPropertiesSection: React.FC<{ physical?: PhysicalProperties; compact?: boolean }> =
  memo(({ physical, compact = false }) => {
    return (
      <div className={`property-section physical-section ${compact ? 'compact' : ''}`}>
        <h5>Physical Properties</h5>
        <div className="property-grid">
          <PropertyRow
            label="Diameter"
            value={physical?.diameter}
            unit="km"
            compact={compact}
          />
          <PropertyRow label="Albedo" value={physical?.albedo} compact={compact} />
          <PropertyRow
            label="Rotation Period"
            value={physical?.rotation_period}
            unit="hours"
            compact={compact}
          />
          <PropertyRow
            label="Density"
            value={physical?.density}
            unit="g/cm³"
            compact={compact}
          />
        </div>
      </div>
    );
  });

PhysicalPropertiesSection.displayName = 'PhysicalPropertiesSection';

const PropertyRow: React.FC<{
  label: string;
  value?: string | number;
  unit?: string;
  compact?: boolean;
}> = memo(({ label, value, unit, compact = false }) => {
  const displayValue = value !== undefined && value !== null ? value : 'N/A';
  const hasValue = value !== undefined && value !== null;

  return (
    <div className={`property-row ${compact ? 'compact' : ''} ${!hasValue ? 'no-value' : ''}`}>
      <div className="property-label">{label}:</div>
      <div className="property-value">
        {hasValue ? (
          <>
            {typeof value === 'number' ? formatNumber(value) : value}
            {unit && hasValue ? <span className="unit"> {unit}</span> : null}
          </>
        ) : (
          <span className="na-value">N/A</span>
        )}
      </div>
    </div>
  );
});

PropertyRow.displayName = 'PropertyRow';

const getAsteroidDisplayName = (asteroid: Asteroid): string => {
  if (asteroid.identifiers?.proper_name) {
    return asteroid.identifiers.proper_name;
  }
  if (asteroid.identifiers?.official_number) {
    return `(${asteroid.identifiers.official_number})`;
  }
  if (asteroid.identifiers?.provisional_designation) {
    return asteroid.identifiers.provisional_designation;
  }
  return `Asteroid ${asteroid.id}`;
};

const formatNumber = (value: number): string => {
  if (value === 0) return '0';

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(3);
  }

  if (Math.abs(value) >= 0.001) {
    return value.toFixed(6);
  }

  return value.toExponential(3);
};

export default PropertiesPanel;
