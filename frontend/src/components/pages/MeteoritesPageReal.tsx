import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataTable, { Column } from '../common/DataTable';
import Pagination from '../common/Pagination';
import SearchBox from '../common/SearchBox';
import ClassificationTree from '../common/ClassificationTree';
import AddToCartButton from '../common/AddToCartButton';
import CartIndicator from '../common/CartIndicator';
import ExportModal from '../export/ExportModal';
// import MeteoriteSpectrumPreview from '../spectral/MeteoriteSpectrumPreview';
import './MeteoritesPage.css';

interface Meteorite {
    id: number;
    specimen_id: string;
    specimen_name: string;
    specimen_type: string;
    main_label: string;
    sub_label: string | null;
    sub_sub_label: string | null;
}

interface ClassificationNode {
    label: string;
    count: number;
    children?: ClassificationNode[];
}

const MeteoritesPageReal: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [data, setData] = useState<Meteorite[]>([]);
    const [classifications, setClassifications] = useState<ClassificationNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination - initialize from URL
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '50'));
    const [total, setTotal] = useState(0);
    
    // Sort state - initialize from URL
    const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'specimen_id');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sort_order') as 'asc' | 'desc') || 'asc');

    // Filters - initialize from URL
    const [selectedClassifications, setSelectedClassifications] = useState<string[]>(
        searchParams.get('main_label') ? [searchParams.get('main_label')!] : []
    );
    const [selectedTypes, setSelectedTypes] = useState<string[]>(
        searchParams.get('specimen_type') ? [searchParams.get('specimen_type')!] : []
    );
    
    // Search state - initialize from URL params
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [searchType, setSearchType] = useState<'all' | 'exact' | 'fuzzy'>((searchParams.get('search_type') as 'all' | 'exact' | 'fuzzy') || 'all');
    const [searchField, setSearchField] = useState(searchParams.get('search_field') || 'all');
    
    // Expanded spectrum state
    const [expandedSpectrumId, setExpandedSpectrumId] = useState<number | null>(null);
    const [spectrumData, setSpectrumData] = useState<any>(null);
    const [spectrumLoading, setSpectrumLoading] = useState(false);
    const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; wavelength: number; reflectance: number } | null>(null);
    
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
        
        // Filters
        if (selectedClassifications.length > 0) {
            params.set('main_label', selectedClassifications[0]);
        }
        if (selectedTypes.length > 0) {
            params.set('specimen_type', selectedTypes[0]);
        }
        
        // Search
        if (searchQuery) {
            params.set('search', searchQuery);
            params.set('search_type', searchType);
            if (searchField !== 'all') params.set('search_field', searchField);
        }
        
        setSearchParams(params, { replace: true });
    }, [
        currentPage, pageSize, sortBy, sortOrder,
        selectedClassifications, selectedTypes,
        searchQuery, searchType, searchField
    ]);

    // Load classifications on mount
    useEffect(() => {
        loadClassifications();
    }, []);

    // Load data when filters or pagination change
    useEffect(() => {
        loadData();
    }, [currentPage, pageSize, sortBy, sortOrder, selectedClassifications, selectedTypes, searchQuery, searchType]);

    const loadClassifications = async () => {
        try {
            const response = await fetch('/api/meteorites/classifications');
            const result = await response.json();
            setClassifications(result.classifications || []);
        } catch (err) {
            console.error('Failed to load classifications:', err);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: currentPage.toString(),
                page_size: pageSize.toString(),
                sort_by: sortBy,
                sort_order: sortOrder,
            });

            if (selectedClassifications.length > 0) {
                params.append('main_label', selectedClassifications[0]); // API supports one at a time
            }

            if (selectedTypes.length > 0) {
                params.append('specimen_type', selectedTypes[0]);
            }
            
            // Search parameters
            if (searchQuery) {
                params.append('search', searchQuery);
                params.append('search_type', searchType);
                if (searchField !== 'all') {
                    params.append('search_field', searchField);
                }
            }

            const response = await fetch(`/api/meteorites?${params}`);
            const result = await response.json();

            setData(result.meteorites || []);
            setTotal(result.pagination?.total || 0);
        } catch (err) {
            setError('Failed to load meteorite data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Handle classification filter
    const handleClassificationToggle = (classification: string) => {
        setSelectedClassifications(prev =>
            prev.includes(classification)
                ? prev.filter(c => c !== classification)
                : [classification] // Only allow one for now
        );
        setCurrentPage(1);
    };
    
    const renderSpectrumChart = (spectrum: any) => {
        // Handle both 'wavelength' and 'wavelengths' (database inconsistency)
        let wavelengths = spectrum.wavelength || spectrum.wavelengths;
        let reflectance = spectrum.reflectance;
        
        if (!wavelengths || !reflectance) {
            return <p>Invalid spectrum data</p>;
        }
        
        // Preprocessing: Create paired data and filter invalid values
        const pairedData: Array<{wavelength: number, reflectance: number}> = [];
        for (let i = 0; i < wavelengths.length; i++) {
            const wl = wavelengths[i];
            const ref = reflectance[i];
            
            // Filter out NaN, null, undefined, and negative values
            if (wl != null && ref != null && 
                !isNaN(wl) && !isNaN(ref) && 
                isFinite(wl) && isFinite(ref) &&
                ref >= 0) {
                pairedData.push({ wavelength: wl, reflectance: ref });
            }
        }
        
        // Check if we have valid data after filtering
        if (pairedData.length === 0) {
            return <p>No valid spectrum data available</p>;
        }
        
        // Sort by wavelength (ascending order)
        pairedData.sort((a, b) => a.wavelength - b.wavelength);
        
        // Extract sorted arrays
        wavelengths = pairedData.map(d => d.wavelength);
        reflectance = pairedData.map(d => d.reflectance);
        
        const width = 800;
        const height = 320;
        const padding = { top: 20, right: 20, bottom: 60, left: 60 };
        
        const xMin = Math.min(...wavelengths);
        const xMax = Math.max(...wavelengths);
        const yMin = Math.min(...reflectance);
        const yMax = Math.max(...reflectance);
        
        // Add small padding to y-axis range for better visualization
        const yRange = yMax - yMin;
        const yPadding = yRange * 0.05;
        const yMinPadded = Math.max(0, yMin - yPadding);
        const yMaxPadded = yMax + yPadding;
        
        const xScale = (x: number) => 
            padding.left + ((x - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
        
        const yScale = (y: number) => 
            height - padding.bottom - ((y - yMinPadded) / (yMaxPadded - yMinPadded)) * (height - padding.top - padding.bottom);
        
        const points = wavelengths.map((x: number, i: number) => ({
            x: xScale(x),
            y: yScale(reflectance[i]),
            wavelength: x,
            reflectance: reflectance[i]
        }));
        
        const pathData = points.map((p: any, i: number) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ');
        
        // Generate X-axis ticks (already in μm)
        const numTicks = 6;
        const xTicks = [];
        for (let i = 0; i <= numTicks; i++) {
            const value = xMin + (xMax - xMin) * (i / numTicks);
            xTicks.push({
                value: value,
                position: xScale(value),
                label: value.toFixed(2)
            });
        }
        
        // Generate Y-axis ticks (use padded range)
        const yNumTicks = 5;
        const yTicks = [];
        for (let i = 0; i <= yNumTicks; i++) {
            const value = yMinPadded + (yMaxPadded - yMinPadded) * (i / yNumTicks);
            yTicks.push({
                value: value,
                position: yScale(value),
                label: value.toFixed(3)
            });
        }
        
        return (
            <svg width={width} height={height} className="spectrum-svg">
                {/* Y-axis */}
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} 
                      stroke="#333" strokeWidth="2" />
                
                {/* X-axis */}
                <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} 
                      stroke="#333" strokeWidth="2" />
                
                {/* Y-axis grid lines and ticks */}
                {yTicks.map((tick, i) => (
                    <g key={i}>
                        <line x1={padding.left - 5} y1={tick.position} x2={padding.left} y2={tick.position} 
                              stroke="#333" strokeWidth="1" />
                        <line x1={padding.left} y1={tick.position} x2={width - padding.right} y2={tick.position} 
                              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,2" />
                        <text x={padding.left - 10} y={tick.position + 4} textAnchor="end" fontSize="11" fill="#666">
                            {tick.label}
                        </text>
                    </g>
                ))}
                
                {/* X-axis ticks and labels */}
                {xTicks.map((tick, i) => (
                    <g key={i}>
                        <line x1={tick.position} y1={height - padding.bottom} x2={tick.position} y2={height - padding.bottom + 5} 
                              stroke="#333" strokeWidth="1" />
                        <text x={tick.position} y={height - padding.bottom + 20} textAnchor="middle" fontSize="12" fill="#333" fontWeight="500">
                            {tick.label}
                        </text>
                    </g>
                ))}
                
                {/* Spectrum line */}
                <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
                
                {/* Interactive overlay for hover */}
                <rect
                    x={padding.left}
                    y={padding.top}
                    width={width - padding.left - padding.right}
                    height={height - padding.top - padding.bottom}
                    fill="transparent"
                    onMouseMove={(e) => {
                        const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                        if (!svgRect) return;
                        
                        const mouseX = e.clientX - svgRect.left;
                        
                        // Find closest data point
                        let closestIndex = 0;
                        let minDistance = Infinity;
                        
                        points.forEach((point: any, index: number) => {
                            const distance = Math.abs(point.x - mouseX);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestIndex = index;
                            }
                        });
                        
                        if (minDistance < 20) { // Only show if within 20px
                            const point = points[closestIndex];
                            setHoverPoint({
                                x: point.x,
                                y: point.y,
                                wavelength: point.wavelength,
                                reflectance: point.reflectance
                            });
                        } else {
                            setHoverPoint(null);
                        }
                    }}
                    onMouseLeave={() => setHoverPoint(null)}
                    style={{ cursor: 'crosshair' }}
                />
                
                {/* Hover point indicator */}
                {hoverPoint && (
                    <>
                        {/* Crosshair lines */}
                        <line x1={hoverPoint.x} y1={padding.top} x2={hoverPoint.x} y2={height - padding.bottom}
                              stroke="#999" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1={padding.left} y1={hoverPoint.y} x2={width - padding.right} y2={hoverPoint.y}
                              stroke="#999" strokeWidth="1" strokeDasharray="3,3" />
                        
                        {/* Data point */}
                        <circle cx={hoverPoint.x} cy={hoverPoint.y} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                    </>
                )}
                
                {/* Axis labels */}
                <text x={width / 2} y={height - padding.bottom + 38} textAnchor="middle" fontSize="14" fill="#333" fontWeight="500">
                    Wavelength (μm)
                </text>
                <text x={20} y={height / 2} textAnchor="middle" fontSize="14" fill="#333" fontWeight="500"
                      transform={`rotate(-90, 20, ${height / 2})`}>
                    Reflectance
                </text>
            </svg>
        );
    };

    // Reset filters
    const handleResetFilters = () => {
        setSelectedClassifications([]);
        setSelectedTypes([]);
        setSearchQuery('');
        setSearchType('all');
        setSearchField('all');
        setCurrentPage(1);
        setSortBy('specimen_id');
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
        { value: 'specimen_name', label: 'Specimen Name' },
        { value: 'main_label', label: 'Main Classification' },
        { value: 'sub_label', label: 'Sub Classification' },
        { value: 'specimen_type', label: 'Specimen Type' },
    ];
    
    const handleViewSpectrum = async (meteoriteId: number) => {
        if (expandedSpectrumId === meteoriteId) {
            // Close if already open
            setExpandedSpectrumId(null);
            setSpectrumData(null);
            return;
        }
        
        setExpandedSpectrumId(meteoriteId);
        setSpectrumLoading(true);
        setSpectrumData(null);
        
        try {
            const response = await fetch(`/api/meteorites/${meteoriteId}/spectrum`);
            if (response.ok) {
                const data = await response.json();
                setSpectrumData(data.spectrum);
            } else {
                setSpectrumData({ error: 'No spectrum data available' });
            }
        } catch (err) {
            setSpectrumData({ error: 'Failed to load spectrum' });
        } finally {
            setSpectrumLoading(false);
        }
    };

    // Get unique specimen types from current data (for future use)
    // const specimenTypes = Array.from(new Set(data.map(d => d.specimen_type).filter(Boolean)));

    // Table columns
    const columns: Column<Meteorite>[] = [
        {
            key: 'specimen_id',
            title: 'Specimen ID',
            sortable: true,
            width: '150px',
        },
        {
            key: 'specimen_name',
            title: 'Name',
            sortable: true,
            width: '200px',
            render: (value) => <strong>{value}</strong>,
        },
        {
            key: 'specimen_type',
            title: 'Type',
            sortable: true,
            width: '150px',
        },
        {
            key: 'main_label',
            title: 'Classification',
            sortable: true,
            render: (value) => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: '#dbeafe',
                    color: '#1e40af',
                }}>
                    {value}
                </span>
            ),
        },
        {
            key: 'sub_label',
            title: 'Sub-classification',
            sortable: true,
            render: (value) => value || '-',
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
                            navigate(`/meteorites/${record.id}`);
                        }}
                    >
                        View Details
                    </a>
                    <a
                        href="#"
                        className="action-link"
                        onClick={(e) => {
                            e.preventDefault();
                            handleViewSpectrum(record.id);
                        }}
                    >
                        {expandedSpectrumId === record.id ? '▼ Hide Spectrum' : '▶ View Spectrum'}
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
                        <h1>Meteorite Spectral Database</h1>
                        <p>Browse spectral data from meteorite specimens</p>
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
                            placeholder="Search meteorites (name, class, type...)"
                            loading={loading}
                            searchFields={searchFields}
                        />
                    </div>

                    {/* Classification Filter */}
                    <div className="filter-group">
                        <div className="filter-group-title">Classification</div>
                        <ClassificationTree
                            data={classifications}
                            selectedItems={selectedClassifications}
                            onToggle={handleClassificationToggle}
                        />
                    </div>

                    {/* Filter Actions */}
                    <div className="filter-actions">
                        <button className="reset-filters-btn" onClick={handleResetFilters}>
                            Reset
                        </button>
                    </div>
                </div>

                {/* Results Section */}
                <div className="results-section">
                    <div className="results-header">
                        <div className="results-count">
                            Showing <strong>{data.length}</strong> of <strong>{total}</strong> meteorite specimens
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
                        emptyText="No meteorite specimens found matching your filters"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={handleSortChange}
                        expandedRowKeys={expandedSpectrumId ? [expandedSpectrumId] : []}
                        expandedRowRender={(record) => {
                            if (record.id !== expandedSpectrumId) return null;
                            
                            return (
                                <div className="expanded-spectrum-panel">
                                    {spectrumLoading && (
                                        <div className="spectrum-loading">
                                            <div className="spinner">⟳</div>
                                            <p>Loading spectrum...</p>
                                        </div>
                                    )}
                                    
                                    {!spectrumLoading && spectrumData && spectrumData.error && (
                                        <div className="spectrum-error">
                                            <p>❌ {spectrumData.error}</p>
                                        </div>
                                    )}
                                    
                                    {!spectrumLoading && spectrumData && !spectrumData.error && (
                                        <div className="spectrum-display">
                                            <div className="spectrum-header">
                                                <h4>Reflectance Spectrum - {record.specimen_name}</h4>
                                                <div className="spectrum-actions">
                                                    <AddToCartButton 
                                                        item={{
                                                            id: `meteorite-${record.id}`,
                                                            type: 'meteorite',
                                                            name: record.specimen_name,
                                                            classification: record.main_label,
                                                            meteoriteId: record.id,
                                                            specimenType: record.specimen_type,
                                                            addedAt: Date.now()
                                                        }}
                                                    />
                                                    <button 
                                                        className="close-spectrum-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedSpectrumId(null);
                                                        }}
                                                    >
                                                        × Close
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="spectrum-chart-wrapper">
                                                {renderSpectrumChart(spectrumData)}
                                            </div>
                                            <div className="spectrum-info">
                                                {(() => {
                                                    const wavelengths = spectrumData.wavelength || spectrumData.wavelengths;
                                                    if (!wavelengths) return <span>No wavelength data</span>;
                                                    
                                                    const rangeText = `Wavelength range: ${Math.min(...wavelengths).toFixed(2)} - ${Math.max(...wavelengths).toFixed(2)} μm`;
                                                    const hoverText = hoverPoint 
                                                        ? ` | Wavelength: ${hoverPoint.wavelength.toFixed(3)} μm | Reflectance: ${hoverPoint.reflectance.toFixed(4)}`
                                                        : ' | Wavelength: 0.000 μm | Reflectance: 0.0000';
                                                    
                                                    return <span>{rangeText}{hoverText}</span>;
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }}
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
                dataType="meteorites"
                currentResults={data}
            />
        </div>
    );
};

export default MeteoritesPageReal;
