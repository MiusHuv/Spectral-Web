import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import './SpectralDiagnostics.css';

interface SpectralDiagnosticsProps {
  isVisible: boolean;
  onClose: () => void;
}

interface DiagnosticReport {
  asteroid_id: number;
  name: string;
  has_spectral_data: boolean;
  data_quality: 'good' | 'warning' | 'error' | 'missing';
  issues: string[];
  wavelengths_count?: number;
  reflectances_count?: number;
  length_mismatch?: boolean;
  normalized?: boolean;
  spectral_class?: string;
}

const SpectralDiagnostics: React.FC<SpectralDiagnosticsProps> = ({
  isVisible,
  onClose
}) => {
  const { state } = useAppContext();
  const [filter, setFilter] = useState<'all' | 'good' | 'warning' | 'error' | 'missing'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'quality' | 'issues'>('id');

  // Generate diagnostic report for all asteroids with spectral data
  const diagnosticReports = useMemo((): DiagnosticReport[] => {
    const reports: DiagnosticReport[] = [];

    // Check all selected asteroids first
    state.selectedAsteroids.forEach(asteroidId => {
      const asteroid = state.asteroidData[asteroidId];
      const spectralData = state.spectralData[asteroidId];

      if (asteroid) {
        const report = generateDiagnosticReport(asteroid, spectralData, asteroidId);
        reports.push(report);
      }
    });

    // Also check asteroids that have spectral data but aren't selected
    Object.entries(state.spectralData).forEach(([id, spectralData]) => {
      const asteroidId = parseInt(id);
      if (!state.selectedAsteroids.includes(asteroidId)) {
        const asteroid = state.asteroidData[asteroidId];
        const report = generateDiagnosticReport(asteroid, spectralData, asteroidId);
        reports.push(report);
      }
    });

    return reports;
  }, [state.selectedAsteroids, state.asteroidData, state.spectralData]);

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    let filtered = diagnosticReports;

    if (filter !== 'all') {
      filtered = filtered.filter(report => report.data_quality === filter);
    }

    // Sort reports
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'id':
          return a.asteroid_id - b.asteroid_id;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'quality':
          const qualityOrder = { good: 0, warning: 1, error: 2, missing: 3 };
          return qualityOrder[a.data_quality] - qualityOrder[b.data_quality];
        case 'issues':
          return a.issues.length - b.issues.length;
        default:
          return 0;
      }
    });

    return filtered;
  }, [diagnosticReports, filter, sortBy]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = diagnosticReports.length;
    const good = diagnosticReports.filter(r => r.data_quality === 'good').length;
    const warning = diagnosticReports.filter(r => r.data_quality === 'warning').length;
    const error = diagnosticReports.filter(r => r.data_quality === 'error').length;
    const missing = diagnosticReports.filter(r => r.data_quality === 'missing').length;

    return { total, good, warning, error, missing };
  }, [diagnosticReports]);

  const exportReport = () => {
    const exportData = {
      metadata: {
        generated_at: new Date().toISOString(),
        total_asteroids: summaryStats.total,
        summary: summaryStats,
        filters_applied: filter !== 'all' ? filter : null
      },
      reports: filteredReports.map(report => ({
        asteroid_id: report.asteroid_id,
        name: report.name,
        has_spectral_data: report.has_spectral_data,
        data_quality: report.data_quality,
        issues: report.issues,
        wavelengths_count: report.wavelengths_count,
        reflectances_count: report.reflectances_count,
        length_mismatch: report.length_mismatch,
        normalized: report.normalized,
        spectral_class: report.spectral_class
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spectral-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isVisible) return null;

  return (
    <div className="spectral-diagnostics-overlay">
      <div className="spectral-diagnostics-panel">
        <div className="diagnostics-header">
          <h3>Spectral Data Diagnostics</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close diagnostics">
            ✕
          </button>
        </div>

        <div className="diagnostics-summary">
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{summaryStats.total}</span>
            </div>
            <div className="stat-item good">
              <span className="stat-label">Good</span>
              <span className="stat-value">{summaryStats.good}</span>
            </div>
            <div className="stat-item warning">
              <span className="stat-label">Warning</span>
              <span className="stat-value">{summaryStats.warning}</span>
            </div>
            <div className="stat-item error">
              <span className="stat-label">Error</span>
              <span className="stat-value">{summaryStats.error}</span>
            </div>
            <div className="stat-item missing">
              <span className="stat-label">Missing</span>
              <span className="stat-value">{summaryStats.missing}</span>
            </div>
          </div>
        </div>

        <div className="diagnostics-controls">
          <div className="filter-controls">
            <label htmlFor="quality-filter">Filter by Quality:</label>
            <select
              id="quality-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="good">Good</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="missing">Missing</option>
            </select>
          </div>

          <div className="sort-controls">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="id">ID</option>
              <option value="name">Name</option>
              <option value="quality">Quality</option>
              <option value="issues">Issues</option>
            </select>
          </div>

          <button className="export-btn" onClick={exportReport}>
            📊 Export Report
          </button>
        </div>

        <div className="diagnostics-content">
          <div className="reports-list">
            {filteredReports.map((report) => (
              <div key={report.asteroid_id} className={`report-item ${report.data_quality}`}>
                <div className="report-header">
                  <div className="asteroid-info">
                    <span className="asteroid-id">#{report.asteroid_id}</span>
                    <span className="asteroid-name">{report.name}</span>
                  </div>
                  <div className={`quality-badge ${report.data_quality}`}>
                    {report.data_quality.toUpperCase()}
                  </div>
                </div>

                <div className="report-details">
                  <div className="data-status">
                    <span className={`status-indicator ${report.has_spectral_data ? 'has-data' : 'no-data'}`}>
                      {report.has_spectral_data ? '📊' : '❌'}
                    </span>
                    <span className="status-text">
                      {report.has_spectral_data ? 'Has spectral data' : 'No spectral data'}
                    </span>
                  </div>

                  {report.issues.length > 0 && (
                    <div className="issues-list">
                      <div className="issues-header">Issues:</div>
                      <ul>
                        {report.issues.map((issue, index) => (
                          <li key={index} className="issue-item">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.has_spectral_data && (
                    <div className="data-details">
                      <div className="detail-item">
                        <span className="detail-label">Wavelengths:</span>
                        <span className="detail-value">{report.wavelengths_count || 0}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Reflectances:</span>
                        <span className="detail-value">{report.reflectances_count || 0}</span>
                      </div>
                      {report.length_mismatch && (
                        <div className="detail-item warning">
                          ⚠️ Length mismatch detected
                        </div>
                      )}
                      {report.normalized !== undefined && (
                        <div className="detail-item">
                          <span className="detail-label">Normalized:</span>
                          <span className="detail-value">{report.normalized ? 'Yes' : 'No'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to generate diagnostic report for a single asteroid
function generateDiagnosticReport(
  asteroid: any,
  spectralData: any,
  asteroidId: number
): DiagnosticReport {
  const name = asteroid?.proper_name ||
               asteroid?.provisional_designation ||
               `Asteroid ${asteroidId}`;

  if (!spectralData) {
    return {
      asteroid_id: asteroidId,
      name,
      has_spectral_data: false,
      data_quality: 'missing',
      issues: ['No spectral data available'],
      spectral_class: asteroid?.bus_demeo_class || asteroid?.tholen_class
    };
  }

  const issues: string[] = [];
  let dataQuality: DiagnosticReport['data_quality'] = 'good';

  // Check wavelengths
  if (!Array.isArray(spectralData.wavelengths)) {
    issues.push('Wavelengths is not an array');
    dataQuality = 'error';
  } else if (spectralData.wavelengths.length === 0) {
    issues.push('Wavelengths array is empty');
    dataQuality = 'error';
  } else {
    const nonNumeric = spectralData.wavelengths.filter((w: any) => typeof w !== 'number' || !Number.isFinite(w));
    if (nonNumeric.length > 0) {
      issues.push(`${nonNumeric.length} non-numeric wavelength values`);
      dataQuality = dataQuality === 'good' ? 'warning' : 'error';
    }
  }

  // Check reflectances
  if (!Array.isArray(spectralData.reflectances)) {
    issues.push('Reflectances is not an array');
    dataQuality = 'error';
  } else if (spectralData.reflectances.length === 0) {
    issues.push('Reflectances array is empty');
    dataQuality = 'error';
  } else {
    const nonNumeric = spectralData.reflectances.filter((r: any) => typeof r !== 'number' || !Number.isFinite(r));
    if (nonNumeric.length > 0) {
      issues.push(`${nonNumeric.length} non-numeric reflectance values`);
      dataQuality = dataQuality === 'good' ? 'warning' : 'error';
    }

    const noDataValues = spectralData.reflectances.filter((r: any) => r === null || r === undefined);
    if (noDataValues.length > 0) {
      issues.push(`${noDataValues.length} null/undefined reflectance values`);
      dataQuality = dataQuality === 'good' ? 'warning' : 'error';
    }
  }

  // Check length consistency
  if (Array.isArray(spectralData.wavelengths) &&
      Array.isArray(spectralData.reflectances) &&
      spectralData.wavelengths.length !== spectralData.reflectances.length) {
    issues.push('Wavelengths and reflectances length mismatch');
    dataQuality = dataQuality === 'good' ? 'warning' : 'error';
  }

  return {
    asteroid_id: asteroidId,
    name,
    has_spectral_data: true,
    data_quality: dataQuality,
    issues,
    wavelengths_count: Array.isArray(spectralData.wavelengths) ? spectralData.wavelengths.length : 0,
    reflectances_count: Array.isArray(spectralData.reflectances) ? spectralData.reflectances.length : 0,
    length_mismatch: Array.isArray(spectralData.wavelengths) &&
                     Array.isArray(spectralData.reflectances) &&
                     spectralData.wavelengths.length !== spectralData.reflectances.length,
    normalized: spectralData.normalized,
    spectral_class: asteroid?.bus_demeo_class || asteroid?.tholen_class
  };
}

export default SpectralDiagnostics;
