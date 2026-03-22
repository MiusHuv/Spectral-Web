import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MeteoritesPage.css';

interface AsteroidDetail {
    id: number;
    official_number: number | null;
    proper_name: string | null;
    provisional_designation: string | null;
    bus_demeo_class: string | null;
    tholen_class: string | null;
    sdss_class: string | null;
    orbital_class: string | null;
    semi_major_axis: number | null;
    eccentricity: number | null;
    inclination: number | null;
    orbital_period: number | null;
    perihelion_distance: number | null;
    aphelion_distance: number | null;
    diameter: number | null;
    albedo: number | null;
    rotation_period: number | null;
    density: number | null;
    GM: number | null;
    extent: string | null;
    observation_count: number;
}

const AsteroidDetailPage: React.FC = () => {
    const { asteroidId } = useParams<{ asteroidId: string }>();
    const navigate = useNavigate();
    
    const [asteroid, setAsteroid] = useState<AsteroidDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAsteroid();
    }, [asteroidId]);

    const loadAsteroid = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/v2/asteroids/${asteroidId}`);
            const result = await response.json();
            
            if (response.ok) {
                setAsteroid(result.asteroid);
            } else {
                setError(result.error || 'Failed to load asteroid');
            }
        } catch (err) {
            setError('Failed to load asteroid data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getAsteroidName = () => {
        if (!asteroid) return '';
        if (asteroid.proper_name) return asteroid.proper_name;
        if (asteroid.official_number) return `(${asteroid.official_number})`;
        if (asteroid.provisional_designation) return asteroid.provisional_designation;
        return `Asteroid ${asteroid.id}`;
    };

    const InfoRow: React.FC<{ label: string; value: any; unit?: string }> = ({ label, value, unit }) => (
        <div style={{ 
            display: 'flex', 
            padding: '12px 0', 
            borderBottom: '1px solid #e5e7eb',
            alignItems: 'center'
        }}>
            <div style={{ flex: '0 0 200px', fontWeight: 500, color: '#374151' }}>
                {label}
            </div>
            <div style={{ flex: 1, color: '#111827' }}>
                {value !== null && value !== undefined ? (
                    <>
                        {typeof value === 'number' ? value.toFixed(4) : value}
                        {unit && <span style={{ marginLeft: '4px', color: '#6b7280' }}>{unit}</span>}
                    </>
                ) : (
                    <span style={{ color: '#9ca3af' }}>N/A</span>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="meteorites-page">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div>Loading asteroid data...</div>
                </div>
            </div>
        );
    }

    if (error || !asteroid) {
        return (
            <div className="meteorites-page">
                <div style={{ padding: '40px', textAlign: 'center', color: '#991b1b' }}>
                    {error || 'Asteroid not found'}
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
                        <h1>{getAsteroidName()}</h1>
                        <p>Asteroid ID: {asteroid.id}</p>
                        {asteroid.provisional_designation && asteroid.proper_name && (
                            <p style={{ fontSize: '14px', color: '#666' }}>
                                Also known as: {asteroid.provisional_designation}
                            </p>
                        )}
                    </div>
                    <div className="page-actions">
                        <button className="action-btn" onClick={() => navigate('/asteroids')}>
                            ← Back to List
                        </button>
                        {asteroid.observation_count > 0 && (
                            <button 
                                className="action-btn primary"
                                onClick={() => navigate(`/asteroids/${asteroid.id}/observations`)}
                            >
                                View Observations ({asteroid.observation_count})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Classification */}
                    <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
                            Classification
                        </h2>
                        <InfoRow label="Bus-DeMeo Class" value={asteroid.bus_demeo_class} />
                        <InfoRow label="Tholen Class" value={asteroid.tholen_class} />
                        <InfoRow label="SDSS Class" value={asteroid.sdss_class} />
                        <InfoRow label="Orbital Class" value={asteroid.orbital_class} />
                    </div>

                    {/* Physical Properties */}
                    <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
                            Physical Properties
                        </h2>
                        <InfoRow label="Diameter" value={asteroid.diameter} unit="km" />
                        <InfoRow label="Albedo" value={asteroid.albedo} />
                        <InfoRow label="Rotation Period" value={asteroid.rotation_period} unit="hours" />
                        <InfoRow label="Density" value={asteroid.density} unit="g/cm³" />
                        <InfoRow label="GM" value={asteroid.GM} unit="km³/s²" />
                        <InfoRow label="Extent" value={asteroid.extent} />
                    </div>

                    {/* Orbital Elements */}
                    <div style={{ 
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        gridColumn: '1 / -1'
                    }}>
                        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
                            Orbital Elements
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
                            <InfoRow label="Semi-major Axis" value={asteroid.semi_major_axis} unit="AU" />
                            <InfoRow label="Eccentricity" value={asteroid.eccentricity} />
                            <InfoRow label="Inclination" value={asteroid.inclination} unit="°" />
                            <InfoRow label="Orbital Period" value={asteroid.orbital_period} unit="days" />
                            <InfoRow label="Perihelion Distance" value={asteroid.perihelion_distance} unit="AU" />
                            <InfoRow label="Aphelion Distance" value={asteroid.aphelion_distance} unit="AU" />
                        </div>
                    </div>

                    {/* Observations Info */}
                    {asteroid.observation_count > 0 && (
                        <div style={{ 
                            background: '#f0fdf4', 
                            borderRadius: '8px', 
                            padding: '20px',
                            border: '1px solid #86efac',
                            gridColumn: '1 / -1'
                        }}>
                            <h2 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 600, color: '#15803d' }}>
                                Spectral Observations Available
                            </h2>
                            <p style={{ marginBottom: '16px', color: '#166534' }}>
                                This asteroid has <strong>{asteroid.observation_count}</strong> spectral observation(s) in the database.
                            </p>
                            <button 
                                className="action-btn primary"
                                onClick={() => navigate(`/asteroids/${asteroid.id}/observations`)}
                            >
                                View All Observations →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AsteroidDetailPage;
