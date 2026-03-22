import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, CartItem } from '../../contexts/CartContext';
import SpectrumChart from '../spectral/SpectrumChart';
import './ComparePage.css';

interface SpectrumData {
    id: string;
    name: string;
    wavelengths: number[];
    reflectances: (number | null)[];
    color?: string;
    type: 'asteroid' | 'meteorite';
}

const ComparePage: React.FC = () => {
    const navigate = useNavigate();
    const { items, removeFromCart, clearCart } = useCart();
    const [spectraData, setSpectraData] = useState<SpectrumData[]>([]);
    const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAllSpectra();
    }, [items]);

    const loadAllSpectra = async () => {
        if (items.length === 0) {
            setSpectraData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
        const loadedSpectra: SpectrumData[] = [];
        const newColorMap = new Map<string, string>();

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const assignedColor = colors[i % colors.length];
            // 为每个 item 分配颜色
            newColorMap.set(item.id, assignedColor);
            
            try {
                let spectrum;
                
                if (item.type === 'meteorite') {
                    const response = await fetch(`/api/meteorites/${item.meteoriteId}/spectrum`);
                    if (response.ok) {
                        const data = await response.json();
                        spectrum = data.spectrum;
                    }
                } else if (item.type === 'asteroid') {
                    // 修复：使用正确的 API 端点
                    const response = await fetch(`/api/v2/asteroids/observations/${item.observationId}/spectrum`);
                    if (response.ok) {
                        const data = await response.json();
                        spectrum = data.spectrum;
                    }
                }

                if (spectrum) {
                    const wavelengths = spectrum.wavelength || spectrum.wavelengths;
                    const reflectances = spectrum.reflectance || spectrum.reflectances;
                    
                    if (wavelengths && reflectances) {
                        loadedSpectra.push({
                            id: item.id,
                            name: item.name,
                            wavelengths,
                            reflectances,
                            color: assignedColor,
                            type: item.type
                        });
                    }
                }
            } catch (err) {
                console.error(`Failed to load spectrum for ${item.name}:`, err);
            }
        }

        setColorMap(newColorMap);
        setSpectraData(loadedSpectra);
        setLoading(false);
    };

    const handleRemove = (id: string) => {
        removeFromCart(id);
    };

    if (items.length === 0) {
        return (
            <div className="compare-page">
                <div className="page-header">
                    <h1>Spectrum Comparison</h1>
                </div>
                <div className="empty-cart">
                    <div className="empty-cart-icon">📊</div>
                    <h2>No Spectra to Compare</h2>
                    <p>Add spectra to your cart from the meteorites or asteroids pages to compare them here.</p>
                    <div className="empty-cart-actions">
                        <button className="action-btn primary" onClick={() => navigate('/meteorites')}>
                            Browse Meteorites
                        </button>
                        <button className="action-btn" onClick={() => navigate('/asteroids')}>
                            Browse Asteroids
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="compare-page">
            <div className="page-header">
                <div className="header-content">
                    <h1>Spectrum Comparison ({items.length} items)</h1>
                    <button className="clear-cart-btn" onClick={clearCart}>
                        Clear All
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner">⟳</div>
                    <p>Loading spectra...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>❌ {error}</p>
                </div>
            ) : (
                <>
                    {/* Spectrum Chart */}
                    <div className="chart-section">
                        <SpectrumChart
                            spectra={spectraData}
                            title="Spectral Comparison"
                            height={500}
                            showLegend={true}
                            showGrid={true}
                        />
                    </div>

                    {/* Sample Information Cards */}
                    <div className="samples-section">
                        <h2>Sample Information</h2>
                        <div className="samples-grid">
                            {items.map((item) => (
                                <div key={item.id} className={`sample-card ${item.type}`}>
                                    <div className="sample-header">
                                        <div 
                                            className="sample-color-indicator" 
                                            style={{ background: colorMap.get(item.id) || '#999' }}
                                        />
                                        <h3>{item.name}</h3>
                                        <button 
                                            className="remove-btn" 
                                            onClick={() => handleRemove(item.id)}
                                            title="Remove from comparison"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    
                                    <div className="sample-info">
                                        <div className="info-row">
                                            <span className="label">Type:</span>
                                            <span className="value">{item.type === 'meteorite' ? 'Meteorite' : 'Asteroid'}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="label">Classification:</span>
                                            <span className="value">{item.classification || 'N/A'}</span>
                                        </div>
                                        
                                        {item.type === 'meteorite' && (
                                            <>
                                                <div className="info-row">
                                                    <span className="label">Specimen Type:</span>
                                                    <span className="value">{item.specimenType || 'N/A'}</span>
                                                </div>
                                            </>
                                        )}
                                        
                                        {item.type === 'asteroid' && (
                                            <>
                                                {item.asteroidNumber && (
                                                    <div className="info-row">
                                                        <span className="label">Number:</span>
                                                        <span className="value">#{item.asteroidNumber}</span>
                                                    </div>
                                                )}
                                                {item.band && (
                                                    <div className="info-row">
                                                        <span className="label">Band:</span>
                                                        <span className="value">{item.band}</span>
                                                    </div>
                                                )}
                                                {item.mission && (
                                                    <div className="info-row">
                                                        <span className="label">Mission:</span>
                                                        <span className="value">{item.mission}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        
                                        <div className="info-row">
                                            <span className="label">Added:</span>
                                            <span className="value">{new Date(item.addedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ComparePage;
