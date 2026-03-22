import React, { useState } from 'react';
import './SearchBox.css';

interface SearchField {
    value: string;
    label: string;
}

interface SearchBoxProps {
    onSearch: (query: string, type: 'all' | 'exact' | 'fuzzy', field?: string) => void;
    placeholder?: string;
    loading?: boolean;
    searchFields?: SearchField[];
}

const SearchBox: React.FC<SearchBoxProps> = ({
    onSearch,
    placeholder = "Search...",
    loading = false,
    searchFields = []
}) => {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'all' | 'exact' | 'fuzzy'>('all');
    const [selectedField, setSelectedField] = useState<string>('all');

    const handleSearch = () => {
        onSearch(query.trim(), searchType, selectedField !== 'all' ? selectedField : undefined);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleClear = () => {
        setQuery('');
        onSearch('', searchType, selectedField !== 'all' ? selectedField : undefined);
    };

    const handleTypeChange = (newType: 'all' | 'exact' | 'fuzzy') => {
        setSearchType(newType);
        if (query.trim()) {
            onSearch(query.trim(), newType, selectedField !== 'all' ? selectedField : undefined);
        }
    };

    const handleFieldChange = (field: string) => {
        setSelectedField(field);
        if (query.trim()) {
            onSearch(query.trim(), searchType, field !== 'all' ? field : undefined);
        }
    };

    return (
        <div className="search-box">
            {searchFields.length > 0 && (
                <div className="search-field-selector">
                    <label className="search-field-label">Search in:</label>
                    <select 
                        className="search-field-select"
                        value={selectedField}
                        onChange={(e) => handleFieldChange(e.target.value)}
                    >
                        <option value="all">All Fields</option>
                        {searchFields.map(field => (
                            <option key={field.value} value={field.value}>
                                {field.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="search-input"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                {query && !loading && (
                    <button className="search-clear" onClick={handleClear} title="Clear">
                        ×
                    </button>
                )}
                {loading && <div className="search-loading">⟳</div>}
            </div>
            
            <div className="search-mode-tabs">
                <button
                    className={`mode-tab ${searchType === 'all' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('all')}
                >
                    Smart
                </button>
                <button
                    className={`mode-tab ${searchType === 'exact' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('exact')}
                >
                    Exact
                </button>
                <button
                    className={`mode-tab ${searchType === 'fuzzy' ? 'active' : ''}`}
                    onClick={() => handleTypeChange('fuzzy')}
                >
                    Fuzzy
                </button>
            </div>
        </div>
    );
};

export default SearchBox;
