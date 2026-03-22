import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DataTable, { Column } from '../common/DataTable';
import SpectrumChart from '../spectral/SpectrumChart';
import AddToCartButton from '../common/AddToCartButton';
import CartIndicator from '../common/CartIndicator';
import { CartItem } from '../../contexts/CartContext';
import './MeteoritesPage.css';

interface Observation {
    id: number;
    asteroid_id: number;
    start_time: string | null;
    stop_time: string | null;
    band: string | null;
    mission: string | null;
    data_source: string | null;
    reference_text: string | null;
}

interface SpectrumData {
    id: string;
    name: string;
    wavelengths: number[];
    reflectances: (number | null)[];
    color?: string;
    metadata?: any;
}

const AsteroidObservationsPage: React.FC = () => {
    const { asteroidId } = useParams<{ asteroidId: string }>();
    const navigate = useNavigate();
    
    const [observations, setObservations] = useState<Observation[]>([]);
    const [asteroidName, setAsteroidName] = useState<string>('');
    const [asteroidClass, setAsteroidClass] = useState<string>('');
    const [asteroidNumber, setAsteroidNumber] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Spectrum preview and comparison
    const [selectedObservations, setSelectedObservations] = useState<number[]>([]);
    const [spectraData, setSpectraData] = useState<SpectrumData[]>([]);
    const [loadingSpectra, setLoadingSpectra] = useState(false);
    
    // Filtering
    const [missionFilter, setMissionFilter] = useState<string>('all');
    const [bandFilter, setBandFilter] = useState<string>('all');
    const [availableMissions, setAvailableMissions] = useState<string[]>([]);
    const [availableBands, setAvailableBands] = useState<string[]>([]);

    useEffect(() => {
        loadObservations();
        loadAsteroidInfo();
    }, [asteroidId]);

    useEffect(() => {
        if (selectedObservations.length > 0) {
            loadSpectra();
        } else {
            setSpectraData([]);
        }
    }, [selectedObservations]);

    const loadAsteroidInfo = async () => {
        try {
            const response = await fetch(`/api/v2/asteroids/${asteroidId}`);
            const result = await response.json();
            
            if (response.ok) {
                const asteroid = result.asteroid;
                const name = asteroid.proper_name || 
                            (asteroid.official_number ? `(${asteroid.official_number})` : '') ||
                            asteroid.provisional_designation ||
                            `Asteroid ${asteroid.id}`;
                setAsteroidName(name);
                setAsteroidClass(asteroid.bus_demeo_class || asteroid.tholen_class || 'Unknown');
                setAsteroidNumber(asteroid.official_number || '');
            }
        } catch (err) {
            console.error('Failed to load asteroid info:', err);
        }
    };

    const loadObservations = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/v2/asteroids/${asteroidId}/observations`);
            const result = await response.json();
            
            if (response.ok) {
                const obs = result.observations || [];
                setObservations(obs);
                
                // Extract unique missions and bands for filtering
                const missions = new Set<string>();
                const bands = new Set<string>();
                
                obs.forEach((o: Observation) => {
                    if (o.mission) missions.add(o.mission);
                    if (o.band) bands.add(o.band);
                });
                
                setAvailableMissions(Array.from(missions).sort());
                setAvailableBands(Array.from(bands).sort());
            } else {
                setError(result.error || 'Failed to load observations');
            }
        } catch (err) {
            setError('Failed to load observation data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadSpectra = async () => {
        setLoadingSpectra(true);
        
        try {
            const spectra: SpectrumData[] = [];
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
            
            for (let i = 0; i < selectedObservations.length; i++) {
                const obsId = selectedObservations[i];
                const response = await fetch(`/api/v2/asteroids/observations/${obsId}/spectrum`);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // 检查光谱数据格式
                    let wavelengths: number[] = [];
                    let reflectances: (number | null)[] = [];
                    
                    if (result.spectrum) {
                        // 如果是对象格式 {wavelengths: [], reflectances: []} 或 {wavelengths: [], reflectance: []}
                        if (result.spectrum.wavelengths) {
                            wavelengths = result.spectrum.wavelengths;
                            // 尝试 reflectances (复数) 或 reflectance (单数)
                            reflectances = result.spectrum.reflectances || result.spectrum.reflectance || [];
                        }
                        // 如果是数组格式 [[wl, refl], [wl, refl], ...]
                        else if (Array.isArray(result.spectrum)) {
                            wavelengths = result.spectrum.map((p: any) => p[0] || p.wavelength);
                            reflectances = result.spectrum.map((p: any) => p[1] || p.reflectance);
                        }
                    }
                    
                    if (wavelengths.length > 0) {
                        spectra.push({
                            id: `obs-${obsId}`,
                            name: `Obs ${obsId} (${result.band || 'Unknown'})`,
                            wavelengths,
                            reflectances,
                            color: colors[i % colors.length],
                            metadata: {
                                observation_date: result.observation_date,
                                band: result.band
                            }
                        });
                    }
                }
            }
            
            setSpectraData(spectra);
        } catch (err) {
            console.error('Failed to load spectra:', err);
        } finally {
            setLoadingSpectra(false);
        }
    };

    const handleObservationSelect = (obsId: number) => {
        setSelectedObservations(prev => {
            if (prev.includes(obsId)) {
                return prev.filter(id => id !== obsId);
            } else {
                return [...prev, obsId];
            }
        });
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch {
            return dateString;
        }
    };

    const columns: Column<Observation>[] = [
        {
            key: 'select',
            title: 'Select',
            width: '70px',
            render: (_, record) => (
                <input
                    type="checkbox"
                    checked={selectedObservations.includes(record.id)}
                    onChange={() => handleObservationSelect(record.id)}
                />
            ),
        },
        {
            key: 'id',
            title: 'Obs ID',
            sortable: true,
            width: '100px',
            render: (value) => <strong>#{value}</strong>,
        },
        {
            key: 'start_time',
            title: 'Observation Date',
            sortable: true,
            width: '150px',
            render: (value) => formatDate(value),
        },
        {
            key: 'band',
            title: 'Band',
            sortable: true,
            width: '120px',
            render: (value) => value ? (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: '#dbeafe',
                    color: '#1e40af',
                }}>
                    {value}
                </span>
            ) : '-',
        },
        {
            key: 'mission',
            title: 'Mission',
            sortable: true,
            width: '150px',
            render: (value) => {
                const isGaia = value && value.includes('Gaia');
                return (
                    <span style={isGaia ? { color: '#9ca3af', fontStyle: 'italic' } : {}}>
                        {value || '-'}
                        {isGaia && (
                            <span style={{ fontSize: '11px', marginLeft: '4px' }} title="Gaia provides photometric data, not spectral data">
                                ⓘ
                            </span>
                        )}
                    </span>
                );
            },
        },
        {
            key: 'data_source',
            title: 'Data Source',
            sortable: true,
            width: '200px',
            render: (value) => value || '-',
        },
        {
            key: 'reference_text',
            title: 'Reference',
            sortable: false,
            render: (value) => value ? (
                <div style={{ 
                    maxWidth: '300px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                    color: '#666'
                }}>
                    {value}
                </div>
            ) : '-',
        },
        {
            key: 'actions',
            title: 'Actions',
            width: '150px',
            render: (_, record) => (
                <div className="action-links">
                    <a
                        href="#"
                        className="action-link"
                        onClick={(e) => {
                            e.preventDefault();
                            setSelectedObservations([record.id]);
                        }}
                    >
                        Preview
                    </a>
                </div>
            ),
        },
    ];

    return (
        <div className="meteorites-page">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <div className="page-title-section">
                        <h1>Spectral Observations</h1>
                        <p>{asteroidName}</p>
                        <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                            {observations.length} observation(s) available
                        </p>
                    </div>
                    <div className="page-actions">
                        <CartIndicator />
                        <button className="action-btn" onClick={() => navigate(`/asteroids/${asteroidId}`)}>
                            ← Back to Details
                        </button>
                        <button className="action-btn" onClick={() => navigate('/asteroids')}>
                            Back to List
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
                {error && (
                    <div style={{ 
                        padding: '20px', 
                        background: '#fee2e2', 
                        color: '#991b1b', 
                        borderRadius: '8px', 
                        marginBottom: '20px' 
                    }}>
                        {error}
                    </div>
                )}

                {!loading && observations.length === 0 && (
                    <div style={{ 
                        padding: '40px', 
                        textAlign: 'center',
                        background: 'white',
                        borderRadius: '8px',
                        color: '#666'
                    }}>
                        No spectral observations found for this asteroid.
                    </div>
                )}

                {/* Filters */}
                {!loading && observations.length > 0 && (
                    <div style={{
                        background: 'white',
                        borderRadius: '8px',
                        padding: '15px 20px',
                        marginBottom: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        display: 'flex',
                        gap: '20px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ fontWeight: 600, color: '#374151' }}>Filter by:</div>
                        
                        {/* Mission Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: '#666' }}>Mission:</label>
                            <select
                                value={missionFilter}
                                onChange={(e) => setMissionFilter(e.target.value)}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Missions</option>
                                {availableMissions.map(mission => (
                                    <option key={mission} value={mission}>{mission}</option>
                                ))}
                            </select>
                        </div>

                        {/* Band Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '14px', color: '#666' }}>Band:</label>
                            <select
                                value={bandFilter}
                                onChange={(e) => setBandFilter(e.target.value)}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Bands</option>
                                {availableBands.map(band => (
                                    <option key={band} value={band}>{band}</option>
                                ))}
                            </select>
                        </div>

                        {/* Clear Filters */}
                        {(missionFilter !== 'all' || bandFilter !== 'all') && (
                            <button
                                onClick={() => {
                                    setMissionFilter('all');
                                    setBandFilter('all');
                                }}
                                style={{
                                    padding: '6px 12px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    color: '#6b7280'
                                }}
                            >
                                Clear Filters
                            </button>
                        )}

                        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6b7280' }}>
                            Showing {observations.filter(o => 
                                (missionFilter === 'all' || o.mission === missionFilter) &&
                                (bandFilter === 'all' || o.band === bandFilter)
                            ).length} of {observations.length} observations
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={observations.filter(o => 
                        (missionFilter === 'all' || o.mission === missionFilter) &&
                        (bandFilter === 'all' || o.band === bandFilter)
                    )}
                    loading={loading}
                    rowKey={(record) => record.id}
                    emptyText="No observations match the selected filters"
                />

                {/* Spectrum Preview/Comparison */}
                {selectedObservations.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '20px'
                            }}>
                                <h3 style={{ margin: 0 }}>
                                    {selectedObservations.length === 1 ? 'Spectrum Preview' : `Comparing ${selectedObservations.length} Spectra`}
                                </h3>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button
                                        onClick={() => setSelectedObservations([])}
                                        style={{
                                            padding: '8px 16px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            </div>

                            {loadingSpectra ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                    Loading spectra...
                                </div>
                            ) : spectraData.length > 0 ? (
                                <>
                                    <SpectrumChart
                                        spectra={spectraData}
                                        height={400}
                                        showLegend={spectraData.length > 1}
                                        title={spectraData.length === 1 ? spectraData[0].name : undefined}
                                    />
                                    
                                    {/* Spectrum Info Cards */}
                                    <div style={{ 
                                        marginTop: '20px', 
                                        display: 'grid', 
                                        gridTemplateColumns: spectraData.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                                        gap: '15px'
                                    }}>
                                        {spectraData.map((spectrum, index) => {
                                            const obsId = selectedObservations[index];
                                            const observation = observations.find(o => o.id === obsId);
                                            
                                            return (
                                                <div key={spectrum.id} style={{
                                                    padding: '15px',
                                                    border: `2px solid ${spectrum.color}`,
                                                    borderRadius: '6px',
                                                    background: '#f9fafb'
                                                }}>
                                                    <div style={{ 
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        marginBottom: '10px'
                                                    }}>
                                                        <div style={{ 
                                                            fontSize: '14px', 
                                                            fontWeight: 600,
                                                            color: spectrum.color,
                                                            flex: 1
                                                        }}>
                                                            {spectrum.name}
                                                        </div>
                                                        {observation && (
                                                            <AddToCartButton 
                                                                item={{
                                                                    id: `observation-${obsId}`,
                                                                    type: 'asteroid',
                                                                    name: `${asteroidName} - ${observation.band || 'Unknown'}`,
                                                                    classification: asteroidClass,
                                                                    asteroidId: asteroidId ? parseInt(asteroidId) : undefined,
                                                                    asteroidNumber: asteroidNumber ? parseInt(asteroidNumber) : undefined,
                                                                    observationId: obsId,
                                                                    band: observation.band || undefined,
                                                                    mission: observation.mission || undefined,
                                                                    addedAt: Date.now()
                                                                }}
                                                                size="small"
                                                            />
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                                        <div>Data Points: {spectrum.wavelengths.length}</div>
                                                        <div>
                                                            Range: {Math.min(...spectrum.wavelengths).toFixed(2)} - {Math.max(...spectrum.wavelengths).toFixed(2)} μm
                                                        </div>
                                                        {spectrum.metadata?.observation_date && (
                                                            <div>Date: {spectrum.metadata.observation_date}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div style={{ color: '#991b1b', fontSize: '16px', marginBottom: '10px' }}>
                                        No spectral data available for selected observations
                                    </div>
                                    <div style={{ color: '#666', fontSize: '14px' }}>
                                        Note: Some missions (e.g., Gaia DR3) provide photometric data only, not spectral data.
                                        <br />
                                        Try selecting observations from SMASSII, Spex, or other spectroscopic missions.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AsteroidObservationsPage;
