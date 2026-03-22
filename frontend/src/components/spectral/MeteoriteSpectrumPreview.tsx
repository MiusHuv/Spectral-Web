import React, { useState, useEffect } from 'react';
import './MeteoriteSpectrumPreview.css';

interface SpectrumData {
    wavelength: number[];
    reflectance: number[];
}

interface MeteoriteSpectrumPreviewProps {
    meteoriteId: number;
    meteoriteName: string;
    onClose: () => void;
    onViewFull: () => void;
}

const MeteoriteSpectrumPreview: React.FC<MeteoriteSpectrumPreviewProps> = ({
    meteoriteId,
    meteoriteName,
    onClose,
    onViewFull
}) => {
    const [spectrum, setSpectrum] = useState<SpectrumData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSpectrum();
    }, [meteoriteId]);

    const loadSpectrum = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/meteorites/${meteoriteId}/spectrum`);
            
            if (!response.ok) {
                throw new Error('Failed to load spectrum');
            }

            const data = await response.json();
            
            if (data.spectrum) {
                setSpectrum(data.spectrum);
            } else {
                setError('No spectrum data available');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load spectrum');
        } finally {
            setLoading(false);
        }
    };

    const renderMiniChart = () => {
        if (!spectrum || !spectrum.wavelength || !spectrum.reflectance) {
            return null;
        }

        // Filter out invalid data points (zero/negative wavelengths, negative reflectances)
        const validData: Array<{wavelength: number, reflectance: number}> = [];
        for (let i = 0; i < spectrum.wavelength.length; i++) {
            const wl = spectrum.wavelength[i];
            const refl = spectrum.reflectance[i];
            
            if (wl > 0 && refl >= 0 && isFinite(wl) && isFinite(refl)) {
                validData.push({ wavelength: wl, reflectance: refl });
            }
        }

        if (validData.length === 0) {
            return null;
        }

        const width = 400;
        const height = 150;
        const padding = { top: 10, right: 10, bottom: 30, left: 50 };

        const wavelengths = validData.map(d => d.wavelength);
        const reflectances = validData.map(d => d.reflectance);

        const xMin = Math.min(...wavelengths);
        const xMax = Math.max(...wavelengths);
        const yMin = Math.min(...reflectances);
        const yMax = Math.max(...reflectances);

        const xScale = (x: number) => 
            padding.left + ((x - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
        
        const yScale = (y: number) => 
            height - padding.bottom - ((y - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

        const points = validData.map(d => ({
            x: xScale(d.wavelength),
            y: yScale(d.reflectance)
        }));

        const pathData = points.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ');

        return (
            <svg width={width} height={height} className="mini-spectrum-chart">
                {/* Grid lines */}
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} 
                      stroke="#ddd" strokeWidth="1" />
                <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} 
                      stroke="#ddd" strokeWidth="1" />
                
                {/* Spectrum line */}
                <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
                
                {/* Axes labels */}
                <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="10" fill="#666">
                    Wavelength (nm)
                </text>
                <text x={15} y={height / 2} textAnchor="middle" fontSize="10" fill="#666" 
                      transform={`rotate(-90, 15, ${height / 2})`}>
                    Reflectance
                </text>
            </svg>
        );
    };

    return (
        <div className="spectrum-preview-overlay">
            <div className="spectrum-preview-card">
                <div className="spectrum-preview-header">
                    <h3>{meteoriteName}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="spectrum-preview-content">
                    {loading && (
                        <div className="loading-state">
                            <div className="spinner">⟳</div>
                            <p>Loading spectrum...</p>
                        </div>
                    )}

                    {error && (
                        <div className="error-state">
                            <p>❌ {error}</p>
                        </div>
                    )}

                    {!loading && !error && spectrum && (
                        <>
                            <div className="mini-chart-container">
                                {renderMiniChart()}
                            </div>
                            
                            <div className="spectrum-info">
                                <p>Wavelength range: {Math.min(...spectrum.wavelength.filter(w => w > 0)).toFixed(0)} - {Math.max(...spectrum.wavelength.filter(w => w > 0)).toFixed(0)} nm</p>
                                <p>Data points: {spectrum.wavelength.filter((w, i) => w > 0 && spectrum.reflectance[i] >= 0).length}</p>
                            </div>

                            <div className="preview-actions">
                                <button className="btn-secondary" onClick={onClose}>
                                    Close
                                </button>
                                <button className="btn-primary" onClick={onViewFull}>
                                    View Full Spectrum →
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeteoriteSpectrumPreview;
