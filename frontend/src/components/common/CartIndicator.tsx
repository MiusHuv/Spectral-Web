import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import ExportModal from '../export/ExportModal';
import './CartIndicator.css';

const CartIndicator: React.FC = () => {
    const navigate = useNavigate();
    const { getCartCount, items } = useCart();
    const count = getCartCount();
    
    const [showDropdown, setShowDropdown] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const handleCompareClick = () => {
        setShowDropdown(false);
        navigate('/compare');
    };

    const handleExportClick = () => {
        setShowDropdown(false);
        setIsExportModalOpen(true);
    };

    // Determine data type based on cart items
    const getDataType = (): 'asteroids' | 'meteorites' => {
        if (items.length === 0) return 'asteroids';
        // Use the type of the first item
        return items[0].type === 'asteroid' ? 'asteroids' : 'meteorites';
    };

    return (
        <>
            <div className="cart-indicator-wrapper" ref={dropdownRef}>
                <button 
                    className="cart-indicator" 
                    onClick={() => setShowDropdown(!showDropdown)}
                    title="View spectrum comparison cart"
                >
                    <svg 
                        className="cart-icon" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                    >
                        <path d="M9 2v6m6-6v6M4 8h16M6 8v12a2 2 0 002 2h8a2 2 0 002-2V8" />
                    </svg>
                    {count > 0 && (
                        <span className="cart-badge">{count}</span>
                    )}
                    <span className="cart-label">Compare</span>
                    <svg 
                        className="cart-dropdown-arrow" 
                        viewBox="0 0 12 12" 
                        fill="currentColor"
                        style={{ 
                            width: '12px', 
                            height: '12px', 
                            marginLeft: '4px',
                            transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                        }}
                    >
                        <path d="M6 8L2 4h8z" />
                    </svg>
                </button>

                {showDropdown && (
                    <div className="cart-dropdown">
                        <button 
                            className="cart-dropdown-item"
                            onClick={handleCompareClick}
                        >
                            <svg 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                style={{ width: '16px', height: '16px', marginRight: '8px' }}
                            >
                                <path d="M9 2v6m6-6v6M4 8h16M6 8v12a2 2 0 002 2h8a2 2 0 002-2V8" />
                            </svg>
                            View Comparison
                        </button>
                        <button 
                            className="cart-dropdown-item"
                            onClick={handleExportClick}
                            disabled={count === 0}
                        >
                            <svg 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                style={{ width: '16px', height: '16px', marginRight: '8px' }}
                            >
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Export All ({count})
                        </button>
                    </div>
                )}
            </div>

            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                dataType={getDataType()}
                preselectedItems={items}
            />
        </>
    );
};

export default CartIndicator;
