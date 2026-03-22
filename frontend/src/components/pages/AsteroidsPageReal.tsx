import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataTable, { Column } from '../common/DataTable';
import Pagination from '../common/Pagination';
import RangeSlider from '../common/RangeSlider';
import SearchBox from '../common/SearchBox';
import CartIndicator from '../common/CartIndicator';
import ExportModal from '../export/ExportModal';
import './MeteoritesPage.css';

interface Asteroid {
    id: number;
    official_number: number | null;
    proper_name: string | null;
    provisional_designation: string | null;
    bus_demeo_class: string | null;
    tholen_class: string | null;
    orbital_class: string | null;
    semi_major_axis: number | null;
    diameter: number | null;
    albedo: number | null;
    observation_count: number;
}

interface Classification {
    bus_demeo_class?: string;
    tholen_class?: string;
    count: number;
}

interface OrbitalClass {
    orbital_class: string;
    count: number;
}

interface Stats {
    total_asteroids: number;
    total_observations: number;
    bus_demeo_classes: number;
    tholen_classes: number;
}

const AsteroidsPageReal: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [data, setData] = useState<Asteroid[]>([]);
    const [busClassifications, setBusClassifications] = useState<Classification[]>([]);
    const [tholenClassifications, setTholenClassifications] = useState<Classification[]>([]);
    const [orbitalClasses, setOrbitalClasses] = useState<OrbitalClass[]>([]);
    const [missions, setMissions] = useState<Array<{mission: string, asteroid_count: number, observation_count: number}>>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination - initialize from URL
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '50'));
    const [total, setTotal] = useState(0);
    
    // Sort state - initialize from URL
    const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'official_number');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sort_order') as 'asc' | 'desc') || 'asc');

    // Classification filters - initialize from URL
    const [selectedBusClass, setSelectedBusClass] = useState<string | null>(searchParams.get('bus_demeo_class'));
    const [selectedTholenClass, setSelectedTholenClass] = useState<string | null>(searchParams.get('tholen_class'));
    const [classificationSystem, setClassificationSystem] = useState<'bus' | 'tholen'>(
        searchParams.get('tholen_class') ? 'tholen' : 'bus'
    );
    
    // Orbital class filter - initialize from URL
    const [selectedOrbitalClass, setSelectedOrbitalClass] = useState<string | null>(searchParams.get('orbital_class'));
    
    // Mission filter - initialize from URL
    const [selectedMission, setSelectedMission] = useState<string | null>(searchParams.get('mission'));
    
    // Physical property filters - initialize from URL
    const [diameterRange, setDiameterRange] = useState<[number | null, number | null]>([
        searchParams.get('diameter_min') ? parseFloat(searchParams.get('diameter_min')!) : null,
        searchParams.get('diameter_max') ? parseFloat(searchParams.get('diameter_max')!) : null
    ]);
    const [albedoRange, setAlbedoRange] = useState<[number | null, number | null]>([
        searchParams.get('albedo_min') ? parseFloat(searchParams.get('albedo_min')!) : null,
        searchParams.get('albedo_max') ? parseFloat(searchParams.get('albedo_max')!) : null
    ]);
    
    // Orbital parameter filters - initialize from URL
    const [semiMajorAxisRange, setSemiMajorAxisRange] = useState<[number | null, number | null]>([
        searchParams.get('semi_major_axis_min') ? parseFloat(searchParams.get('semi_major_axis_min')!) : null,
        searchParams.get('semi_major_axis_max') ? parseFloat(searchParams.get('semi_major_axis_max')!) : null
    ]);
    const [eccentricityRange, setEccentricityRange] = useState<[number | null, number | null]>([
        searchParams.get('eccentricity_min') ? parseFloat(searchParams.get('eccentricity_min')!) : null,
        searchParams.get('eccentricity_max') ? parseFloat(searchParams.get('eccentricity_max')!) : null
    ]);
    const [inclinationRange, setInclinationRange] = useState<[number | null, number | null]>([
        searchParams.get('inclination_min') ? parseFloat(searchParams.get('inclination_min')!) : null,
        searchParams.get('inclination_max') ? parseFloat(searchParams.get('inclination_max')!) : null
    ]);
    
    // Observation filter - initialize from URL
    const [hasObservations, setHasObservations] = useState<string | null>(searchParams.get('has_observations'));
    
    // Show advanced filters
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    
    // Search state - initialize from URL params
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [searchType, setSearchType] = useState<'all' | 'exact' | 'fuzzy'>('all');
    const [searchField, setSearchField] = useState('all');
    
    // Export modal state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Update URL params when state changes
    useEffect(() => {
        const params = new URLSearchParams();
        
        // Pagination
        params.set('page', currentPage.toString());
        params.set('page_size', pageSize.toString());
        
        // Sort
        params.set('sort_by', sortBy);
        params.set('sort_order', sortOrder);
        
        // Classification filters
        if (selectedBusClass) params.set('bus_demeo_class', selectedBusClass);
        if (selectedTholenClass) params.set('tholen_class', selectedTholenClass);
        if (selectedOrbitalClass) params.set('orbital_class', selectedOrbitalClass);
        if (selectedMission) params.set('mission', selectedMission);
        
        // Physical property filters
        if (diameterRange[0] !== null) params.set('diameter_min', diameterRange[0].toString());
        if (diameterRange[1] !== null) params.set('diameter_max', diameterRange[1].toString());
        if (albedoRange[0] !== null) params.set('albedo_min', albedoRange[0].toString());
        if (albedoRange[1] !== null) params.set('albedo_max', albedoRange[1].toString());
        
        // Orbital parameter filters
        if (semiMajorAxisRange[0] !== null) params.set('semi_major_axis_min', semiMajorAxisRange[0].toString());
        if (semiMajorAxisRange[1] !== null) params.set('semi_major_axis_max', semiMajorAxisRange[1].toString());
        if (eccentricityRange[0] !== null) params.set('eccentricity_min', eccentricityRange[0].toString());
        if (eccentricityRange[1] !== null) params.set('eccentricity_max', eccentricityRange[1].toString());
        if (inclinationRange[0] !== null) params.set('inclination_min', inclinationRange[0].toString());
        if (inclinationRange[1] !== null) params.set('inclination_max', inclinationRange[1].toString());
        
        // Observation filter
        if (hasObservations) params.set('has_observations', hasObservations);
        
        // Search
        if (searchQuery) {
            params.set('search', searchQuery);
            params.set('search_type', searchType);
            if (searchField !== 'all') params.set('search_field', searchField);
        }
        
        setSearchParams(params, { replace: true });
    }, [
        currentPage, pageSize, sortBy, sortOrder,
        selectedBusClass, selectedTholenClass, selectedOrbitalClass, selectedMission,
        diameterRange, albedoRange, semiMajorAxisRange, eccentricityRange, inclinationRange,
        hasObservations, searchQuery, searchType, searchField
    ]);

    // Load classifications and stats on mount
    useEffect(() => {
        loadClassifications();
        loadOrbitalClasses();
        loadMissions();
        loadStats();
    }, []);

    // Load data when filters or pagination change
    useEffect(() => {
        loadData();
    }, [
        currentPage, 
        pageSize,
        sortBy,
        sortOrder,
        selectedBusClass, 
        selectedTholenClass, 
        selectedOrbitalClass,
        selectedMission,
        diameterRange,
        albedoRange,
        semiMajorAxisRange,
        eccentricityRange,
        inclinationRange,
        hasObservations,
        searchQuery,
        searchType
    ]);

    const loadClassifications = async () => {
        try {
            const response = await fetch('/api/v2/asteroids/classifications');
            const result = await response.json();
            setBusClassifications(result.classifications.bus_demeo || []);
            setTholenClassifications(result.classifications.tholen || []);
        } catch (err) {
            console.error('Failed to load classifications:', err);
        }
    };

    const loadOrbitalClasses = async () => {
        try {
            const response = await fetch('/api/v2/asteroids/orbital-classes');
            const result = await response.json();
            setOrbitalClasses(result.orbital_classes || []);
        } catch (err) {
            console.error('Failed to load orbital classes:', err);
        }
    };

    const loadMissions = async () => {
        try {
            const response = await fetch('/api/v2/asteroids/missions');
            const result = await response.json();
            setMissions(result.missions || []);
        } catch (err) {
            console.error('Failed to load missions:', err);
        }
    };

    const loadStats = async () => {
        try {
            const response = await fetch('/api/v2/asteroids/stats');
            const result = await response.json();
            setStats(result.stats);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                page_size: pageSize.toString(),
                sort_by: sortBy,
                sort_order: sortOrder,
            });

            // Classification filters
            if (selectedBusClass) {
                params.append('bus_demeo_class', selectedBusClass);
            }
            if (selectedTholenClass) {
                params.append('tholen_class', selectedTholenClass);
            }
            if (selectedOrbitalClass) {
                params.append('orbital_class', selectedOrbitalClass);
            }
            if (selectedMission) {
                params.append('mission', selectedMission);
            }

            // Physical property filters
            if (diameterRange[0] !== null) {
                params.append('diameter_min', diameterRange[0].toString());
            }
            if (diameterRange[1] !== null) {
                params.append('diameter_max', diameterRange[1].toString());
            }
            if (albedoRange[0] !== null) {
                params.append('albedo_min', albedoRange[0].toString());
            }
            if (albedoRange[1] !== null) {
                params.append('albedo_max', albedoRange[1].toString());
            }

            // Orbital parameter filters
            if (semiMajorAxisRange[0] !== null) {
                params.append('semi_major_axis_min', semiMajorAxisRange[0].toString());
            }
            if (semiMajorAxisRange[1] !== null) {
                params.append('semi_major_axis_max', semiMajorAxisRange[1].toString());
            }
            if (eccentricityRange[0] !== null) {
                params.append('eccentricity_min', eccentricityRange[0].toString());
            }
            if (eccentricityRange[1] !== null) {
                params.append('eccentricity_max', eccentricityRange[1].toString());
            }
            if (inclinationRange[0] !== null) {
                params.append('inclination_min', inclinationRange[0].toString());
            }
            if (inclinationRange[1] !== null) {
                params.append('inclination_max', inclinationRange[1].toString());
            }

            // Observation filter
            if (hasObservations !== null) {
                params.append('has_observations', hasObservations);
            }
            
            // Search parameters
            if (searchQuery) {
                params.append('search', searchQuery);
                params.append('search_type', searchType);
                if (searchField !== 'all') {
                    params.append('search_field', searchField);
                }
            }

            const response = await fetch(`/api/v2/asteroids?${params}`);
            const result = await response.json();

            setData(result.asteroids || []);
            setTotal(result.pagination?.total || 0);
        } catch (err) {
            setError('Failed to load asteroid data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBusClassToggle = (classification: string) => {
        setSelectedBusClass(prev => prev === classification ? null : classification);
        setSelectedTholenClass(null);
        setCurrentPage(1);
    };

    const handleTholenClassToggle = (classification: string) => {
        setSelectedTholenClass(prev => prev === classification ? null : classification);
        setSelectedBusClass(null);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSelectedBusClass(null);
        setSelectedTholenClass(null);
        setSelectedOrbitalClass(null);
        setSelectedMission(null);
        setDiameterRange([null, null]);
        setAlbedoRange([null, null]);
        setSemiMajorAxisRange([null, null]);
        setEccentricityRange([null, null]);
        setInclinationRange([null, null]);
        setHasObservations(null);
        setSearchQuery('');
        setSearchType('all');
        setSearchField('all');
        setCurrentPage(1);
        setSortBy('official_number');
        setSortOrder('asc');
    };
    
    const handleSortChange = (key: string, order: 'asc' | 'desc') => {
        setSortBy(key);
        setSortOrder(order);
        setCurrentPage(1); // Reset to first page when sorting changes
    };
    
    const handleSearch = (query: string, type: 'all' | 'exact' | 'fuzzy', field?: string) => {
        setSearchQuery(query);
        setSearchType(type);
        setSearchField(field || 'all');
        setCurrentPage(1);
    };
    
    const searchFields = [
        { value: 'official_number', label: 'Number' },
        { value: 'proper_name', label: 'Name' },
        { value: 'bus_demeo_class', label: 'Bus-DeMeo Class' },
        { value: 'tholen_class', label: 'Tholen Class' },
        { value: 'orbital_class', label: 'Orbital Class' },
    ];

    const getAsteroidName = (asteroid: Asteroid) => {
        if (asteroid.proper_name) return asteroid.proper_name;
        if (asteroid.official_number) return `(${asteroid.official_number})`;
        if (asteroid.provisional_designation) return asteroid.provisional_designation;
        return `ID: ${asteroid.id}`;
    };

    const columns: Column<Asteroid>[] = [
        {
            key: 'name',
            title: 'Name / Designation',
            sortable: true,
            width: '200px',
            render: (_, record) => (
                <div>
                    <strong>{getAsteroidName(record)}</strong>
                    {record.provisional_designation && record.proper_name && (
                        <div style={{ fontSize: '11px', color: '#666' }}>
                            {record.provisional_designation}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'bus_demeo_class',
            title: 'Bus-DeMeo',
            sortable: true,
            width: '100px',
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
            key: 'tholen_class',
            title: 'Tholen',
            sortable: true,
            width: '100px',
            render: (value) => value ? (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: '#dcfce7',
                    color: '#166534',
                }}>
                    {value}
                </span>
            ) : '-',
        },
        {
            key: 'orbital_class',
            title: 'Orbital Class',
            sortable: true,
            width: '120px',
            render: (value) => value || '-',
        },
        {
            key: 'semi_major_axis',
            title: 'Semi-major Axis (AU)',
            sortable: true,
            width: '150px',
            render: (value) => value ? Number(value).toFixed(3) : '-',
        },
        {
            key: 'diameter',
            title: 'Diameter (km)',
            sortable: true,
            width: '120px',
            render: (value) => value ? Number(value).toFixed(2) : '-',
        },
        {
            key: 'observation_count',
            title: 'Observations',
            sortable: true,
            width: '120px',
            render: (value) => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: value > 0 ? '#f0fdf4' : '#f3f4f6',
                    color: value > 0 ? '#15803d' : '#6b7280',
                }}>
                    {value || 0}
                </span>
            ),
        },
        {
            key: 'actions',
            title: 'Actions',
            width: '200px',
            render: (_, record) => (
                <div className="action-links">
                    <a
                        href="#"
                        className="action-link"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate(`/asteroids/${record.id}`);
                        }}
                    >
                        View Details
                    </a>
                    {record.observation_count > 0 && (
                        <a
                            href="#"
                            className="action-link"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate(`/asteroids/${record.id}/observations`);
                            }}
                        >
                            View Spectra
                        </a>
                    )}
                </div>
            ),
        },
    ];

    const currentClassifications = classificationSystem === 'bus' ? busClassifications : tholenClassifications;
    const selectedClass = classificationSystem === 'bus' ? selectedBusClass : selectedTholenClass;

    return (
        <div className="meteorites-page">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <div className="page-title-section">
                        <h1>Asteroid Spectral Database</h1>
                        <p>Browse spectral data from asteroid observations</p>
                        {stats && (
                            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                                {stats.total_asteroids.toLocaleString()} asteroids • {stats.total_observations.toLocaleString()} observations
                            </div>
                        )}
                    </div>
                    <div className="page-actions">
                        <CartIndicator />
                        <button className="action-btn" onClick={() => navigate('/')}>
                            ← Back to Home
                        </button>
                        <button 
                            className="action-btn primary"
                            onClick={() => setIsExportModalOpen(true)}
                        >
                            Export Data
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="page-content">
                {/* Filters Sidebar */}
                <div className="filters-sidebar">
                    <h3 className="filters-title">Search & Filters</h3>
                    
                    {/* Search Box */}
                    <div className="filter-group">
                        <SearchBox
                            onSearch={handleSearch}
                            placeholder="Search asteroids (name, number, class...)"
                            loading={loading}
                            searchFields={searchFields}
                        />
                    </div>

                    {/* Classification System Toggle */}
                    <div className="filter-group">
                        <div className="filter-group-title">Classification System</div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    background: classificationSystem === 'bus' ? '#3b82f6' : 'white',
                                    color: classificationSystem === 'bus' ? 'white' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                }}
                                onClick={() => {
                                    setClassificationSystem('bus');
                                    setSelectedTholenClass(null);
                                }}
                            >
                                Bus-DeMeo
                            </button>
                            <button
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    background: classificationSystem === 'tholen' ? '#3b82f6' : 'white',
                                    color: classificationSystem === 'tholen' ? 'white' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                }}
                                onClick={() => {
                                    setClassificationSystem('tholen');
                                    setSelectedBusClass(null);
                                }}
                            >
                                Tholen
                            </button>
                        </div>
                    </div>

                    {/* Classification Filter */}
                    <div className="filter-group">
                        <div className="filter-group-title">
                            {classificationSystem === 'bus' ? 'Bus-DeMeo Classes' : 'Tholen Classes'}
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {currentClassifications.map(classification => {
                                const classValue = classificationSystem === 'bus' 
                                    ? classification.bus_demeo_class 
                                    : classification.tholen_class;
                                
                                if (!classValue) return null;
                                
                                const isUnclassified = classValue === 'UNCLASSIFIED';
                                const displayName = isUnclassified ? '(Unclassified)' : classValue;
                                
                                return (
                                    <div key={classValue} className="filter-checkbox">
                                        <input
                                            type="checkbox"
                                            id={`class-${classValue}`}
                                            checked={selectedClass === classValue}
                                            onChange={() => {
                                                if (classificationSystem === 'bus') {
                                                    handleBusClassToggle(classValue);
                                                } else {
                                                    handleTholenClassToggle(classValue);
                                                }
                                            }}
                                        />
                                        <label 
                                            htmlFor={`class-${classValue}`}
                                            style={isUnclassified ? { fontStyle: 'italic', color: '#666' } : {}}
                                        >
                                            {displayName}
                                        </label>
                                        <span className="count">({classification.count.toLocaleString()})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Advanced Filters Toggle */}
                    <div className="filter-group">
                        <button
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                background: showAdvancedFilters ? '#f3f4f6' : 'white',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        >
                            {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
                        </button>
                    </div>

                    {/* Advanced Filters */}
                    {showAdvancedFilters && (
                        <>
                            {/* Orbital Class Filter */}
                            <div className="filter-group">
                                <div className="filter-group-title">Orbital Class</div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {orbitalClasses.map(oc => (
                                        <div key={oc.orbital_class} className="filter-checkbox">
                                            <input
                                                type="checkbox"
                                                id={`orbital-${oc.orbital_class}`}
                                                checked={selectedOrbitalClass === oc.orbital_class}
                                                onChange={() => {
                                                    setSelectedOrbitalClass(
                                                        selectedOrbitalClass === oc.orbital_class ? null : oc.orbital_class
                                                    );
                                                    setCurrentPage(1);
                                                }}
                                            />
                                            <label htmlFor={`orbital-${oc.orbital_class}`}>
                                                {oc.orbital_class}
                                            </label>
                                            <span className="count">({oc.count.toLocaleString()})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mission Filter */}
                            <div className="filter-group">
                                <div className="filter-group-title">Mission</div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {missions.map(m => (
                                        <div key={m.mission} className="filter-checkbox">
                                            <input
                                                type="checkbox"
                                                id={`mission-${m.mission}`}
                                                checked={selectedMission === m.mission}
                                                onChange={() => {
                                                    setSelectedMission(
                                                        selectedMission === m.mission ? null : m.mission
                                                    );
                                                    setCurrentPage(1);
                                                }}
                                            />
                                            <label htmlFor={`mission-${m.mission}`}>
                                                {m.mission}
                                            </label>
                                            <span className="count">({m.asteroid_count.toLocaleString()} asteroids)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Observation Filter */}
                            <div className="filter-group">
                                <div className="filter-group-title">Observations</div>
                                <div className="filter-checkbox">
                                    <input
                                        type="radio"
                                        id="obs-all"
                                        name="observations"
                                        checked={hasObservations === null}
                                        onChange={() => {
                                            setHasObservations(null);
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <label htmlFor="obs-all">All</label>
                                </div>
                                <div className="filter-checkbox">
                                    <input
                                        type="radio"
                                        id="obs-yes"
                                        name="observations"
                                        checked={hasObservations === 'true'}
                                        onChange={() => {
                                            setHasObservations('true');
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <label htmlFor="obs-yes">With Observations</label>
                                </div>
                                <div className="filter-checkbox">
                                    <input
                                        type="radio"
                                        id="obs-no"
                                        name="observations"
                                        checked={hasObservations === 'false'}
                                        onChange={() => {
                                            setHasObservations('false');
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <label htmlFor="obs-no">Without Observations</label>
                                </div>
                            </div>

                            {/* Physical Properties */}
                            <div className="filter-group">
                                <div className="filter-group-title">Physical Properties</div>
                                <RangeSlider
                                    label="Diameter"
                                    min={0}
                                    max={1000}
                                    step={1}
                                    value={diameterRange}
                                    onChange={(val) => {
                                        setDiameterRange(val);
                                        setCurrentPage(1);
                                    }}
                                    unit="km"
                                />
                                <RangeSlider
                                    label="Albedo"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={albedoRange}
                                    onChange={(val) => {
                                        setAlbedoRange(val);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>

                            {/* Orbital Parameters */}
                            <div className="filter-group">
                                <div className="filter-group-title">Orbital Parameters</div>
                                <RangeSlider
                                    label="Semi-major Axis"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={semiMajorAxisRange}
                                    onChange={(val) => {
                                        setSemiMajorAxisRange(val);
                                        setCurrentPage(1);
                                    }}
                                    unit="AU"
                                />
                                <RangeSlider
                                    label="Eccentricity"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={eccentricityRange}
                                    onChange={(val) => {
                                        setEccentricityRange(val);
                                        setCurrentPage(1);
                                    }}
                                />
                                <RangeSlider
                                    label="Inclination"
                                    min={0}
                                    max={180}
                                    step={1}
                                    value={inclinationRange}
                                    onChange={(val) => {
                                        setInclinationRange(val);
                                        setCurrentPage(1);
                                    }}
                                    unit="°"
                                />
                            </div>
                        </>
                    )}

                    {/* Filter Actions */}
                    <div className="filter-actions">
                        <button className="reset-filters-btn" onClick={handleResetFilters}>
                            Reset All Filters
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                <div className="results-section">
                    <div className="results-header">
                        <div className="results-count">
                            Showing <strong>{data.length}</strong> of <strong>{total.toLocaleString()}</strong> asteroids
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px' }}>
                            {error}
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={data}
                        loading={loading}
                        rowKey={(record) => record.id}
                        emptyText="No asteroids found matching your filters"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={handleSortChange}
                    />

                    <Pagination
                        current={currentPage}
                        total={total}
                        pageSize={pageSize}
                        onChange={setCurrentPage}
                        showSizeChanger
                        onPageSizeChange={setPageSize}
                        pageSizeOptions={[25, 50, 100]}
                    />
                </div>
            </div>
            
            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                dataType="asteroids"
                currentResults={data}
            />
        </div>
    );
};

export default AsteroidsPageReal;
