import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SpectrumChart from '../spectral/SpectrumChart';
import './MeteoritesPage.css';

interface SpectrumData {
    id: string;
    name: string;
    type: 'asteroid' | 'meteorite';
    classification?: string;
    wavelengths: number[];
    reflectances: (number | null)[];
    metadata?: any;
}

const SpectrumViewerPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [spectra, setSpectra] = useState<SpectrumData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Comparison mode
    const [comparisonMode, setComparisonMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchType, setSearchType] = useState<'asteroid' | 'meteorite'>('asteroid');

    useEffect(() => {
        loadSpectra();
    }, [searchParams]);

    const loadSpectra = async () => {
        setLoading(true);
        setError(null);

        try {
            const loadedSpectra: SpectrumData[] = [];

            // Load asteroid observations
            const asteroidObsIds = searchParams.getAll('asteroid_obs');
            for (const obsId of asteroidObsIds) {
                const spectrum = await loadAsteroidSpectrum(parseInt(obsId));
                if (spectrum) loadedSpectra.push(spectrum);
            }

            // Load meteorite spectra
            const meteoriteIds = searchParams.getAll('meteorite');
            for (const metId of meteoriteIds) {
                const spectrum = await loadMeteoriteSpectrum(parseInt(metId));
                if (spectrum) loadedSpectra.push(spectrum);
            }

            setSpectra(loadedSpectra);
            setComparisonMode(loadedSpectra.length > 1);
        } catch (err) {
            setError('Failed to load spectra');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadAsteroidSpectrum = async (obsId: number): Promise<SpectrumData | null> => {
        try {
            const response = await fetch(`/api/v2/asteroids/observations/${obsId}/spectrum`);
            const result = await response.json();

            if (response.ok) {
                return {
                    id: `asteroid-obs-${obsId}`,
                    name: `${result.asteroid_name} (Obs ${obsId})`,
                    type: 'asteroid',
                    classification: result.band,
                    wavelengths: result.spectrum.wavelengths || [],
                    reflectances: result.spectrum.reflectances || [],
                    metadata: {
                        observation_date: result.observation_date,
                        band: result.band
                    }
                };
            }
            return null;
        } catch (err) {
            console.error(`Failed to load asteroid observation ${obsId}:`, err);
            return null;
        }
    };

    const loadMeteoriteSpectrum = async (metId: number): Promise<SpectrumData | null> => {
        try {
            const response = await fetch(`/api/meteorites/${metId}/spectrum`);
            const result = await response.json();

            if (response.ok) {
                return {
                    id: `meteorite-${metId}`,
                    name: result.name,
                    type: 'meteorite',
                    classification: result.classification,
                    wavelengths: result.spectrum.wavelengths || [],
                    reflectances: result.spectrum.reflectances || [],
                    metadata: result.metadata
                };
            }
            return null;
        } catch (err) {
            console.error(`Failed to load meteorite ${metId}:`, err);
            return null;
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            let url = '';
            if (searchType === 'asteroid') {
                url = `/api/v2/asteroids?page=1&page_size=10`;
                // Add search logic here
            } else {
                url = `/api/meteorites?page=1&page_size=10`;
            }

            const response = await fetch(url);
            const result = await response.json();
            
            if (searchType === 'asteroid') {
                setSearchResults(result.asteroids || []);
            } else {
                setSearchResults(result.meteorites || []);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    };

    const addToComparison = (item: any) => {
        const params = new URLSearchParams(searchParams);
        
        if (searchType === 'asteroid' && item.observation_count > 0) {
            // Would need to select specific observation
            alert('Please select a specific observation from the asteroid detail page');
        } else if (searchType === 'meteorite') {
            params.append('meteorite', item.id.toString());
            navigate(`/spectrum-viewer?${params.toString()}`);
        }
    };

    const removeSpectrum = (id: string) => {
        const params = new URLSearchParams();
        spectra.forEach(s => {
            if (s.id !== id) {
                if (s.type === 'asteroid') {
                    const obsId = s.id.replace('asteroid-obs-', '');
                    params.append('asteroid_obs', obsId);
                } else {
                    const metId = s.id.replace('meteorite-', '');
                    params.append('meteorite', metId);
                }
            }
        });
        navigate(`/spectrum-viewer?${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="meteorites-page">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    Loading spectra...
                </div>
            </div>
        );
    }

    if (error || spectra.length === 0) {
        return (
            <div className="meteorites-page">
                <div className="page-header">
                    <div className="page-header-content">
                        <h1>Spectrum Viewer</h1>
                        <button className="action-btn" onClick={() => navigate(-1)}>
                            ← Back
                        </button>
                    </div>
                </div>
                <div style={{ padding: '40px', textAlign: 'center', color: '#991b1b' }}>
                    {error || 'No spectra to display'}
                </div>
            </div>
        );
    }

    return (
        <div className="meteorites-page">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <div className="page-title-section">
                        <h1>Spectrum Viewer</h1>
                        <p>{comparisonMode ? `Comparing ${spectra.length} spectra` : 'Single spectrum view'}</p>
                    </div>
                    <div className="page-actions">
                        <button className="action-btn" onClick={() => navigate(-1)}>
                            ← Back
                        </button>
                        <button 
                            className="action-btn primary"
                            onClick={() => setComparisonMode(!comparisonMode)}
                        >
                            {comparisonMode ? 'Exit Comparison' : 'Add to Comparison'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
                {/* Spectrum Chart */}
                <SpectrumChart
                    spectra={spectra.map((s, i) => ({
                        ...s,
                        color: s.type === 'asteroid' ? '#3b82f6' : '#ef4444'
                    }))}
                    title={comparisonMode ? 'Spectral Comparison' : spectra[0]?.name}
                    height={500}
                    showLegend={comparisonMode}
                />

                {/* Spectrum Info */}
                <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: comparisonMode ? '1fr 1fr' : '1fr', gap: '20px' }}>
                    {spectra.map(spectrum => (
                        <div key={spectrum.id} style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: `3px solid ${spectrum.type === 'asteroid' ? '#3b82f6' : '#ef4444'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                                        {spectrum.name}
                                    </h3>
                                    <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                                        {spectrum.type === 'asteroid' ? '🌌 Asteroid' : '🪨 Meteorite'}
                                        {spectrum.classification && ` • ${spectrum.classification}`}
                                    </p>
                                </div>
                                {comparisonMode && (
                                    <button
                                        style={{
                                            padding: '6px 12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        onClick={() => removeSpectrum(spectrum.id)}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>

                            <div style={{ fontSize: '13px', color: '#666' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Data Points:</strong> {spectrum.wavelengths.length}
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Wavelength Range:</strong> {' '}
                                    {Math.min(...spectrum.wavelengths).toFixed(2)} - {Math.max(...spectrum.wavelengths).toFixed(2)} μm
                                </div>
                                {spectrum.metadata && (
                                    <>
                                        {spectrum.metadata.observation_date && (
                                            <div style={{ marginBottom: '8px' }}>
                                                <strong>Observation Date:</strong> {spectrum.metadata.observation_date}
                                            </div>
                                        )}
                                        {spectrum.metadata.band && (
                                            <div style={{ marginBottom: '8px' }}>
                                                <strong>Band:</strong> {spectrum.metadata.band}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add to Comparison */}
                {comparisonMode && (
                    <div style={{
                        marginTop: '30px',
                        background: 'white',
                        borderRadius: '8px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Add More Spectra</h3>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <button
                                style={{
                                    padding: '8px 16px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    background: searchType === 'asteroid' ? '#3b82f6' : 'white',
                                    color: searchType === 'asteroid' ? 'white' : '#333',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSearchType('asteroid')}
                            >
                                Asteroids
                            </button>
                            <button
                                style={{
                                    padding: '8px 16px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    background: searchType === 'meteorite' ? '#ef4444' : 'white',
                                    color: searchType === 'meteorite' ? 'white' : '#333',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSearchType('meteorite')}
                            >
                                Meteorites
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder={`Search ${searchType}s...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                }}
                            />
                            <button
                                onClick={handleSearch}
                                style={{
                                    padding: '10px 20px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                Search
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div style={{ marginTop: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                                {searchResults.map(item => (
                                    <div
                                        key={item.id}
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '4px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <strong>{item.proper_name || item.specimen_name || `ID: ${item.id}`}</strong>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                {searchType === 'asteroid' && item.bus_demeo_class}
                                                {searchType === 'meteorite' && item.main_label}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => addToComparison(item)}
                                            style={{
                                                padding: '6px 12px',
                                                border: 'none',
                                                borderRadius: '4px',
                                                background: '#10b981',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpectrumViewerPage;
