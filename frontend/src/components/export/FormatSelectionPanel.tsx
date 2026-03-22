import React from 'react';
import './FormatSelectionPanel.css';

export interface FormatOption {
    value: 'csv' | 'json' | 'hdf5' | 'fits';
    label: string;
    description: string;
    useCases: string[];
    icon: string;
}

export interface FormatSelectionPanelProps {
    selectedFormat: 'csv' | 'json' | 'hdf5' | 'fits';
    onFormatChange: (format: 'csv' | 'json' | 'hdf5' | 'fits') => void;
    onShowDocumentation?: () => void;
}

const formatOptions: FormatOption[] = [
    {
        value: 'csv',
        label: 'CSV (Comma-Separated Values)',
        description: 'Simple tabular format compatible with Excel, spreadsheets, and most data analysis tools.',
        useCases: [
            'Quick data analysis in Excel or Google Sheets',
            'Import into statistical software (R, SPSS)',
            'Simple data visualization',
            'Easy to read and edit manually'
        ],
        icon: '📊'
    },
    {
        value: 'json',
        label: 'JSON (JavaScript Object Notation)',
        description: 'Structured format with nested data, ideal for web applications and APIs.',
        useCases: [
            'Web application integration',
            'API data exchange',
            'JavaScript/Python data processing',
            'Preserves complex data structures'
        ],
        icon: '{ }'
    },
    {
        value: 'hdf5',
        label: 'HDF5 (Hierarchical Data Format)',
        description: 'Efficient binary format for large datasets with fast read/write and compression.',
        useCases: [
            'Large-scale scientific computing',
            'Machine learning datasets',
            'High-performance data analysis',
            'Efficient storage of spectral arrays'
        ],
        icon: '🗄️'
    },
    {
        value: 'fits',
        label: 'FITS (Flexible Image Transport System)',
        description: 'Standard astronomical data format with metadata headers and multi-dimensional arrays.',
        useCases: [
            'Astronomical data analysis',
            'Compatible with astronomy software (IRAF, DS9)',
            'Preserves scientific metadata',
            'Standard for spectroscopy data'
        ],
        icon: '🔭'
    }
];

const FormatSelectionPanel: React.FC<FormatSelectionPanelProps> = ({
    selectedFormat,
    onFormatChange,
    onShowDocumentation
}) => {
    return (
        <div className="format-selection-panel">
            <div className="format-intro">
                <h3>Choose Your Export Format</h3>
                <p>Select the format that best suits your analysis workflow and tools.</p>
            </div>

            <div className="format-options">
                {formatOptions.map(format => (
                    <div
                        key={format.value}
                        className={`format-card ${selectedFormat === format.value ? 'selected' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onFormatChange(format.value);
                        }}
                        title={`${format.label}: ${format.description}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onFormatChange(format.value);
                            }
                        }}
                    >
                        <div className="format-header">
                            <div className="format-icon" aria-hidden="true">{format.icon}</div>
                            <div className="format-title">
                                <h4>{format.label}</h4>
                                <div className="format-radio">
                                    <input
                                        type="radio"
                                        name="format"
                                        value={format.value}
                                        checked={selectedFormat === format.value}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onFormatChange(format.value);
                                        }}
                                        aria-label={`Select ${format.label}`}
                                        tabIndex={-1}
                                    />
                                </div>
                            </div>
                        </div>

                        <p className="format-description">{format.description}</p>

                        <div className="format-use-cases">
                            <div className="use-cases-label">Best for:</div>
                            <ul className="use-cases-list">
                                {format.useCases.map((useCase, index) => (
                                    <li key={index}>{useCase}</li>
                                ))}
                            </ul>
                        </div>

                        {selectedFormat === format.value && (
                            <div className="format-selected-badge">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Selected</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="format-help">
                <svg className="help-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
                <div className="help-content">
                    <strong>Need help choosing?</strong>
                    <p>
                        For quick analysis, use <strong>CSV</strong>. 
                        For web apps, use <strong>JSON</strong>. 
                        For large datasets, use <strong>HDF5</strong>. 
                        For astronomy tools, use <strong>FITS</strong>.
                    </p>
                    <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onShowDocumentation) {
                                    onShowDocumentation();
                                }
                            }}
                            style={{ 
                                background: 'none',
                                border: 'none',
                                color: '#2563eb', 
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: 0,
                                font: 'inherit'
                            }}
                        >
                            View detailed format documentation →
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FormatSelectionPanel;
