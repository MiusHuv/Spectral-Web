import React, { useState } from 'react';
import './ContentCustomizationPanel.css';

export interface IncludeFields {
    basicInfo: boolean;
    classification: boolean;
    orbitalParams: boolean;
    physicalProps: boolean;
    spectralData: boolean;
}

export interface SpectralOptions {
    wavelengthRange?: [number, number];
    resolution: 'original' | 'resampled';
    includeUncertainty: boolean;
    includeMetadata: boolean;
}

export interface ContentCustomizationPanelProps {
    includeFields: IncludeFields;
    spectralOptions: SpectralOptions;
    onFieldsChange: (fields: IncludeFields) => void;
    onSpectralOptionsChange: (options: SpectralOptions) => void;
    estimatedSize: string;
}

const fieldCategories = [
    {
        key: 'basicInfo' as keyof IncludeFields,
        label: 'Basic Information',
        description: 'Name, ID, designation',
        tooltip: 'Includes object identifiers, names, and designations. Essential for identifying objects in your dataset.',
        icon: '📋'
    },
    {
        key: 'classification' as keyof IncludeFields,
        label: 'Classification',
        description: 'Taxonomic class, type',
        tooltip: 'Includes taxonomic classifications (Bus-DeMeo, Tholen) and orbital/compositional types. Useful for grouping and analyzing objects by type.',
        icon: '🏷️'
    },
    {
        key: 'orbitalParams' as keyof IncludeFields,
        label: 'Orbital Parameters',
        description: 'Semi-major axis, eccentricity, inclination',
        tooltip: 'Includes orbital elements like semi-major axis, eccentricity, inclination, and perihelion/aphelion distances. Essential for dynamical studies.',
        icon: '🌍'
    },
    {
        key: 'physicalProps' as keyof IncludeFields,
        label: 'Physical Properties',
        description: 'Diameter, albedo, mass',
        tooltip: 'Includes physical characteristics like diameter, albedo, rotation period, and density. Important for understanding object properties.',
        icon: '⚖️'
    },
    {
        key: 'spectralData' as keyof IncludeFields,
        label: 'Spectral Data',
        description: 'Wavelength and reflectance measurements',
        tooltip: 'Includes spectral reflectance data across wavelengths. Essential for compositional analysis and spectral classification.',
        icon: '📈'
    }
];

const ContentCustomizationPanel: React.FC<ContentCustomizationPanelProps> = ({
    includeFields,
    spectralOptions,
    onFieldsChange,
    onSpectralOptionsChange,
    estimatedSize
}) => {
    const [showWavelengthRange, setShowWavelengthRange] = useState(false);
    const [minWavelength, setMinWavelength] = useState(spectralOptions.wavelengthRange?.[0] || 0.45);
    const [maxWavelength, setMaxWavelength] = useState(spectralOptions.wavelengthRange?.[1] || 2.45);

    const handleFieldToggle = (field: keyof IncludeFields) => {
        onFieldsChange({
            ...includeFields,
            [field]: !includeFields[field]
        });
    };

    const handleSelectAll = () => {
        onFieldsChange({
            basicInfo: true,
            classification: true,
            orbitalParams: true,
            physicalProps: true,
            spectralData: true
        });
    };

    const handleDeselectAll = () => {
        onFieldsChange({
            basicInfo: false,
            classification: false,
            orbitalParams: false,
            physicalProps: false,
            spectralData: false
        });
    };

    const handleSpectralOptionChange = (key: keyof SpectralOptions, value: any) => {
        onSpectralOptionsChange({
            ...spectralOptions,
            [key]: value
        });
    };

    const handleWavelengthRangeToggle = () => {
        const newShowRange = !showWavelengthRange;
        setShowWavelengthRange(newShowRange);
        
        if (newShowRange) {
            onSpectralOptionsChange({
                ...spectralOptions,
                wavelengthRange: [minWavelength, maxWavelength]
            });
        } else {
            onSpectralOptionsChange({
                ...spectralOptions,
                wavelengthRange: undefined
            });
        }
    };

    const handleWavelengthChange = (type: 'min' | 'max', value: number) => {
        if (type === 'min') {
            setMinWavelength(value);
            onSpectralOptionsChange({
                ...spectralOptions,
                wavelengthRange: [value, maxWavelength]
            });
        } else {
            setMaxWavelength(value);
            onSpectralOptionsChange({
                ...spectralOptions,
                wavelengthRange: [minWavelength, value]
            });
        }
    };

    const selectedCount = Object.values(includeFields).filter(Boolean).length;

    return (
        <div className="content-customization-panel">
            <div className="customization-intro">
                <h3>Customize Your Export</h3>
                <p>Select which data fields to include in your export</p>
            </div>

            {/* Field Categories */}
            <div className="field-categories-section">
                <div className="section-header">
                    <h4>Data Fields</h4>
                    <div className="section-actions">
                        <button className="action-link" onClick={handleSelectAll}>
                            Select All
                        </button>
                        <button className="action-link" onClick={handleDeselectAll}>
                            Deselect All
                        </button>
                    </div>
                </div>

                <div className="field-categories">
                    {fieldCategories.map(category => (
                        <div
                            key={category.key}
                            className={`field-category ${includeFields[category.key] ? 'selected' : ''}`}
                            onClick={() => handleFieldToggle(category.key)}
                            title={category.tooltip}
                        >
                            <div className="category-checkbox">
                                <input
                                    type="checkbox"
                                    checked={includeFields[category.key]}
                                    onChange={() => handleFieldToggle(category.key)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="category-icon">{category.icon}</div>
                            <div className="category-info">
                                <div className="category-label">{category.label}</div>
                                <div className="category-description">{category.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Spectral Options */}
            {includeFields.spectralData && (
                <div className="spectral-options-section">
                    <div className="section-header">
                        <h4>Spectral Data Options</h4>
                    </div>

                    <div className="spectral-options">
                        {/* Wavelength Range */}
                        <div className="option-group">
                            <label 
                                className="option-checkbox"
                                title="Filter spectral data to a specific wavelength range (e.g., 0.5-2.0 μm). Useful for focusing on specific absorption features or reducing file size."
                            >
                                <input
                                    type="checkbox"
                                    checked={showWavelengthRange}
                                    onChange={handleWavelengthRangeToggle}
                                />
                                <span>Custom wavelength range</span>
                            </label>
                            
                            {showWavelengthRange && (
                                <div className="wavelength-range-controls">
                                    <div className="range-input-group">
                                        <label>
                                            Min (μm):
                                            <input
                                                type="number"
                                                min="0.3"
                                                max="2.5"
                                                step="0.05"
                                                value={minWavelength}
                                                onChange={(e) => handleWavelengthChange('min', parseFloat(e.target.value))}
                                            />
                                        </label>
                                        <label>
                                            Max (μm):
                                            <input
                                                type="number"
                                                min="0.3"
                                                max="2.5"
                                                step="0.05"
                                                value={maxWavelength}
                                                onChange={(e) => handleWavelengthChange('max', parseFloat(e.target.value))}
                                            />
                                        </label>
                                    </div>
                                    <div className="range-slider-container">
                                        <input
                                            type="range"
                                            min="0.3"
                                            max="2.5"
                                            step="0.05"
                                            value={minWavelength}
                                            onChange={(e) => handleWavelengthChange('min', parseFloat(e.target.value))}
                                            className="range-slider"
                                        />
                                        <input
                                            type="range"
                                            min="0.3"
                                            max="2.5"
                                            step="0.05"
                                            value={maxWavelength}
                                            onChange={(e) => handleWavelengthChange('max', parseFloat(e.target.value))}
                                            className="range-slider"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Resolution */}
                        <div className="option-group">
                            <label 
                                className="option-label"
                                title="Choose between original measured data points or resampled data on a uniform wavelength grid."
                            >
                                Data Resolution
                            </label>
                            <div className="radio-options">
                                <label 
                                    className="radio-option"
                                    title="Export data at original measurement wavelengths (variable spacing). Best for preserving exact measurements."
                                >
                                    <input
                                        type="radio"
                                        name="resolution"
                                        value="original"
                                        checked={spectralOptions.resolution === 'original'}
                                        onChange={(e) => handleSpectralOptionChange('resolution', e.target.value)}
                                    />
                                    <span>Original (as measured)</span>
                                </label>
                                <label 
                                    className="radio-option"
                                    title="Export data resampled to a uniform wavelength grid. Useful for comparing multiple spectra or machine learning."
                                >
                                    <input
                                        type="radio"
                                        name="resolution"
                                        value="resampled"
                                        checked={spectralOptions.resolution === 'resampled'}
                                        onChange={(e) => handleSpectralOptionChange('resolution', e.target.value)}
                                    />
                                    <span>Resampled (uniform grid)</span>
                                </label>
                            </div>
                        </div>

                        {/* Additional Options */}
                        <div className="option-group">
                            <label 
                                className="option-checkbox"
                                title="Include measurement uncertainty values (standard deviations) for each spectral data point. Important for error propagation and statistical analysis."
                            >
                                <input
                                    type="checkbox"
                                    checked={spectralOptions.includeUncertainty}
                                    onChange={(e) => handleSpectralOptionChange('includeUncertainty', e.target.checked)}
                                />
                                <span>Include measurement uncertainties</span>
                            </label>
                        </div>

                        <div className="option-group">
                            <label 
                                className="option-checkbox"
                                title="Include observation details like date, instrument, data source, and mission. Useful for data provenance and quality assessment."
                            >
                                <input
                                    type="checkbox"
                                    checked={spectralOptions.includeMetadata}
                                    onChange={(e) => handleSpectralOptionChange('includeMetadata', e.target.checked)}
                                />
                                <span>Include observation metadata (date, instrument, mission)</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="customization-summary">
                <div className="summary-item">
                    <svg className="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="summary-text">
                        <strong>{selectedCount}</strong> of {fieldCategories.length} field categories selected
                    </div>
                </div>
                <div className="summary-item">
                    <svg className="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="summary-text">
                        Estimated file size: <strong>{estimatedSize}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContentCustomizationPanel;
