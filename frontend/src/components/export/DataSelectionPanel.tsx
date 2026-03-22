import React, { useState, useEffect } from 'react';
import { CartItem } from '../../contexts/CartContext';
import './DataSelectionPanel.css';

export interface DataSelectionPanelProps {
    dataType: 'asteroids' | 'meteorites';
    cartItems: CartItem[];
    currentResults: any[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

type SelectionMode = 'cart' | 'results';

const DataSelectionPanel: React.FC<DataSelectionPanelProps> = ({
    dataType,
    cartItems,
    currentResults,
    selectedIds,
    onSelectionChange
}) => {
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('cart');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter cart items by data type
    const relevantCartItems = cartItems.filter(item => 
        item.type === (dataType === 'asteroids' ? 'asteroid' : 'meteorite')
    );

    // Filter current results based on search
    const filteredResults = currentResults.filter(item => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        const name = item.name || item.proper_name || item.provisional_designation || '';
        const classification = item.classification || item.bus_demeo_class || item.tholen_class || '';
        return name.toLowerCase().includes(searchLower) || 
               classification.toLowerCase().includes(searchLower) ||
               (item.id && item.id.toString().includes(searchLower));
    });

    // Initialize selection based on mode
    useEffect(() => {
        if (selectionMode === 'cart' && relevantCartItems.length > 0) {
            onSelectionChange(relevantCartItems.map(item => item.id));
        } else if (selectionMode === 'results' && selectedIds.length === 0 && currentResults.length > 0) {
            // Don't auto-select, let user choose
            onSelectionChange([]);
        }
    }, [selectionMode]);

    const handleModeChange = (mode: SelectionMode) => {
        setSelectionMode(mode);
        if (mode === 'cart') {
            onSelectionChange(relevantCartItems.map(item => item.id));
        } else {
            onSelectionChange([]);
        }
        
        // Announce mode change to screen readers
        const announcement = mode === 'cart' 
            ? `Switched to cart selection mode. ${relevantCartItems.length} items available.`
            : `Switched to results selection mode. ${currentResults.length} items available.`;
        announceToScreenReader(announcement);
    };
    
    const announceToScreenReader = (message: string) => {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
    };

    const handleToggleItem = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const handleSelectAll = () => {
        if (selectionMode === 'cart') {
            onSelectionChange(relevantCartItems.map(item => item.id));
        } else {
            onSelectionChange(filteredResults.map(item => item.id.toString()));
        }
    };

    const handleDeselectAll = () => {
        onSelectionChange([]);
    };

    const getItemName = (item: any) => {
        if (dataType === 'asteroids') {
            return item.name || item.proper_name || item.provisional_designation || `ID: ${item.id}`;
        } else {
            // For meteorites, use specimen_name field
            return item.specimen_name || item.name || `ID: ${item.id}`;
        }
    };

    const getItemClassification = (item: any) => {
        if (dataType === 'asteroids') {
            return item.classification || item.bus_demeo_class || item.tholen_class || 'Unclassified';
        } else {
            // For meteorites, use main_label, sub_label, sub_sub_label
            const parts = [];
            if (item.main_label) parts.push(item.main_label);
            if (item.sub_label) parts.push(item.sub_label);
            if (item.sub_sub_label) parts.push(item.sub_sub_label);
            return parts.length > 0 ? parts.join(' - ') : 'Unclassified';
        }
    };

    return (
        <div className="data-selection-panel">
            <div className="selection-mode-toggle" role="radiogroup" aria-label="Data selection mode">
                <button
                    className={`mode-btn ${selectionMode === 'cart' ? 'active' : ''}`}
                    onClick={() => handleModeChange('cart')}
                    role="radio"
                    aria-checked={selectionMode === 'cart'}
                    aria-label={`Export cart items. ${relevantCartItems.length} items in cart.`}
                >
                    <svg className="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 2v6m6-6v6M4 8h16M6 8v12a2 2 0 002 2h8a2 2 0 002-2V8" />
                    </svg>
                    <div className="mode-content">
                        <span className="mode-label">Export Cart Items</span>
                        <span className="mode-count" aria-label={`${relevantCartItems.length} items`}>{relevantCartItems.length} items</span>
                    </div>
                </button>

                <button
                    className={`mode-btn ${selectionMode === 'results' ? 'active' : ''}`}
                    onClick={() => handleModeChange('results')}
                    role="radio"
                    aria-checked={selectionMode === 'results'}
                    aria-label={`Select from current results. ${currentResults.length} items available.`}
                >
                    <svg className="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <div className="mode-content">
                        <span className="mode-label">Select from Current Results</span>
                        <span className="mode-count" aria-label={`${currentResults.length} available`}>{currentResults.length} available</span>
                    </div>
                </button>
            </div>

            {selectionMode === 'cart' ? (
                <div className="selection-content">
                    {relevantCartItems.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 2v6m6-6v6M4 8h16M6 8v12a2 2 0 002 2h8a2 2 0 002-2V8" />
                            </svg>
                            <p className="empty-message">No {dataType} in cart</p>
                            <p className="empty-hint">Add items to your cart or select from current results</p>
                        </div>
                    ) : (
                        <>
                            <div className="selection-header">
                                <p className="selection-info">
                                    All cart items are selected for export
                                </p>
                            </div>
                            <div className="items-list" role="list" aria-label="Cart items for export">
                                {relevantCartItems.map(item => (
                                    <div key={item.id} className="item-card selected" role="listitem">
                                        <div className="item-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => {
                                                    handleToggleItem(item.id);
                                                    announceToScreenReader(
                                                        selectedIds.includes(item.id) 
                                                            ? `${item.name} deselected` 
                                                            : `${item.name} selected`
                                                    );
                                                }}
                                                id={`cart-item-${item.id}`}
                                                aria-label={`Select ${item.name} for export`}
                                            />
                                        </div>
                                        <label htmlFor={`cart-item-${item.id}`} className="item-info">
                                            <div className="item-name">{item.name}</div>
                                            <div className="item-meta">
                                                <span className="item-classification">{item.classification}</span>
                                                {item.mission && (
                                                    <span className="item-mission">{item.mission}</span>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="selection-content">
                    {currentResults.length === 0 ? (
                        <div className="empty-state">
                            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="M21 21l-4.35-4.35" />
                            </svg>
                            <p className="empty-message">No results available</p>
                            <p className="empty-hint">Browse {dataType} to see available items</p>
                        </div>
                    ) : (
                        <>
                            <div className="selection-header">
                                <div className="search-box">
                                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="M21 21l-4.35-4.35" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                                <div className="selection-actions">
                                    <button 
                                        className="action-link"
                                        onClick={handleSelectAll}
                                    >
                                        Select All
                                    </button>
                                    <button 
                                        className="action-link"
                                        onClick={handleDeselectAll}
                                        disabled={selectedIds.length === 0}
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>
                            <div className="items-list">
                                {filteredResults.length === 0 ? (
                                    <div className="no-results">
                                        <p>No items match your search</p>
                                    </div>
                                ) : (
                                    filteredResults.map(item => {
                                        const itemId = item.id.toString();
                                        const isSelected = selectedIds.includes(itemId);
                                        return (
                                            <div 
                                                key={itemId} 
                                                className={`item-card ${isSelected ? 'selected' : ''}`}
                                            >
                                                <div className="item-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleItem(itemId)}
                                                        id={`result-item-${itemId}`}
                                                    />
                                                </div>
                                                <label htmlFor={`result-item-${itemId}`} className="item-info">
                                                    <div className="item-name">{getItemName(item)}</div>
                                                    <div className="item-meta">
                                                        <span className="item-classification">
                                                            {getItemClassification(item)}
                                                        </span>
                                                        {item.observation_count !== undefined && (
                                                            <span className="item-observations">
                                                                {item.observation_count} observations
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="selection-summary">
                <svg className="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="summary-text">
                    <strong>{selectedIds.length}</strong> item{selectedIds.length !== 1 ? 's' : ''} selected for export
                </span>
            </div>
        </div>
    );
};

export default DataSelectionPanel;
