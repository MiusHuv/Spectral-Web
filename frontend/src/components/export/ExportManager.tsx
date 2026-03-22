import React, { useState, useCallback } from 'react';
import { apiClient, apiUtils } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import './ExportManager.css';

export interface ExportManagerProps {
  selectedAsteroidIds: number[];
  onClose?: () => void;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeSpectral: boolean;
  includeRaw: boolean;
  exportType: 'data' | 'spectrum' | 'visualization';
}

export const ExportManager: React.FC<ExportManagerProps> = ({
  selectedAsteroidIds,
  onClose
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeSpectral: false,
    includeRaw: false,
    exportType: 'data'
  });

  const handleExportData = useCallback(async () => {
    if (selectedAsteroidIds.length === 0) {
      setError('No asteroids selected for export');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      let blob: Blob;
      let filename: string;

      if (exportOptions.exportType === 'data') {
        // Export asteroid data
        blob = await apiUtils.withRetry(
          () => apiClient.exportData(selectedAsteroidIds, exportOptions.format, exportOptions.includeSpectral),
          3,
          1000
        );
        filename = `asteroid_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${exportOptions.format}`;
      } else if (exportOptions.exportType === 'spectrum') {
        // Export spectral data
        blob = await apiUtils.withRetry(
          () => apiClient.exportSpectrum(selectedAsteroidIds, exportOptions.includeRaw, exportOptions.format),
          3,
          1000
        );
        filename = `spectral_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${exportOptions.format}`;
      } else {
        throw new Error('Visualization export not yet implemented');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close export dialog after successful export
      if (onClose) {
        onClose();
      }
    } catch (err) {
      const errorMessage = apiUtils.getErrorMessage(err);
      setError(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  }, [selectedAsteroidIds, exportOptions, onClose]);

  const handleExportVisualization = useCallback(async (format: 'png' | 'svg') => {
    setIsExporting(true);
    setError(null);

    try {
      // Get the spectral chart SVG element
      const chartElement = document.querySelector('.spectral-chart svg') as SVGElement;
      if (!chartElement) {
        throw new Error('No spectral chart found to export');
      }

      if (format === 'svg') {
        // Export as SVG
        const svgData = new XMLSerializer().serializeToString(chartElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        
        const url = window.URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `spectral_chart_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Export as PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to create canvas context');
        }

        // Get SVG dimensions
        const svgRect = chartElement.getBoundingClientRect();
        canvas.width = svgRect.width * 2; // Higher resolution
        canvas.height = svgRect.height * 2;
        ctx.scale(2, 2);

        // Create image from SVG
        const svgData = new XMLSerializer().serializeToString(chartElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          // Fill white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
          
          // Draw SVG
          ctx.drawImage(img, 0, 0);
          
          // Convert to PNG and download
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = pngUrl;
              link.download = `spectral_chart_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(pngUrl);
            }
          }, 'image/png');
          
          URL.revokeObjectURL(url);
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          throw new Error('Failed to load SVG for PNG conversion');
        };
        
        img.src = url;
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      const errorMessage = apiUtils.getErrorMessage(err);
      setError(`Visualization export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  }, [onClose]);

  const handleOptionChange = useCallback((key: keyof ExportOptions, value: any) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  return (
    <div className="export-manager">
      <div className="export-manager__header">
        <h3>Export Data</h3>
        {onClose && (
          <button 
            className="export-manager__close"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            ×
          </button>
        )}
      </div>

      <div className="export-manager__content">
        <div className="export-manager__info">
          <p>Selected asteroids: <strong>{selectedAsteroidIds.length}</strong></p>
        </div>

        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={() => setError(null)}
          />
        )}

        <div className="export-manager__options">
          <div className="export-option-group">
            <label className="export-option-group__label">Export Type</label>
            <div className="export-option-group__controls">
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportType"
                  value="data"
                  checked={exportOptions.exportType === 'data'}
                  onChange={(e) => handleOptionChange('exportType', e.target.value)}
                />
                <span>Asteroid Data</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportType"
                  value="spectrum"
                  checked={exportOptions.exportType === 'spectrum'}
                  onChange={(e) => handleOptionChange('exportType', e.target.value)}
                />
                <span>Spectral Data</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportType"
                  value="visualization"
                  checked={exportOptions.exportType === 'visualization'}
                  onChange={(e) => handleOptionChange('exportType', e.target.value)}
                />
                <span>Chart Visualization</span>
              </label>
            </div>
          </div>

          {exportOptions.exportType !== 'visualization' && (
            <div className="export-option-group">
              <label className="export-option-group__label">Format</label>
              <div className="export-option-group__controls">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={exportOptions.format === 'csv'}
                    onChange={(e) => handleOptionChange('format', e.target.value as 'csv' | 'json')}
                  />
                  <span>CSV</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={exportOptions.format === 'json'}
                    onChange={(e) => handleOptionChange('format', e.target.value as 'csv' | 'json')}
                  />
                  <span>JSON</span>
                </label>
              </div>
            </div>
          )}

          {exportOptions.exportType === 'data' && (
            <div className="export-option-group">
              <label className="export-option-group__label">Additional Options</label>
              <div className="export-option-group__controls">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeSpectral}
                    onChange={(e) => handleOptionChange('includeSpectral', e.target.checked)}
                  />
                  <span>Include spectral data</span>
                </label>
              </div>
            </div>
          )}

          {exportOptions.exportType === 'spectrum' && (
            <div className="export-option-group">
              <label className="export-option-group__label">Spectral Options</label>
              <div className="export-option-group__controls">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeRaw}
                    onChange={(e) => handleOptionChange('includeRaw', e.target.checked)}
                  />
                  <span>Include raw (unprocessed) data</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="export-manager__actions">
          {exportOptions.exportType === 'visualization' ? (
            <div className="visualization-export-buttons">
              <button
                className="export-button export-button--primary"
                onClick={() => handleExportVisualization('png')}
                disabled={isExporting || selectedAsteroidIds.length === 0}
              >
                {isExporting ? <LoadingSpinner size="small" /> : 'Export as PNG'}
              </button>
              <button
                className="export-button export-button--secondary"
                onClick={() => handleExportVisualization('svg')}
                disabled={isExporting || selectedAsteroidIds.length === 0}
              >
                {isExporting ? <LoadingSpinner size="small" /> : 'Export as SVG'}
              </button>
            </div>
          ) : (
            <button
              className="export-button export-button--primary"
              onClick={handleExportData}
              disabled={isExporting || selectedAsteroidIds.length === 0}
            >
              {isExporting ? <LoadingSpinner size="small" /> : `Export ${exportOptions.format.toUpperCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportManager;