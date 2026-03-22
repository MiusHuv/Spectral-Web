import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
    id: string;
    type: 'meteorite' | 'asteroid';
    name: string;
    classification: string;
    
    // Meteorite specific
    meteoriteId?: number;
    specimenType?: string;
    
    // Asteroid specific
    asteroidId?: number;
    asteroidNumber?: number;
    observationId?: number;
    band?: string;
    mission?: string;
    
    addedAt: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    isInCart: (id: string) => boolean;
    getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'spectrum_comparison_cart';
const MAX_CART_ITEMS = 10;

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setItems(parsed);
            }
        } catch (error) {
            console.error('Failed to load cart from localStorage:', error);
        }
    }, []);

    // Save to localStorage whenever items change
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        } catch (error) {
            console.error('Failed to save cart to localStorage:', error);
        }
    }, [items]);

    const addToCart = (item: CartItem) => {
        if (items.length >= MAX_CART_ITEMS) {
            alert(`Maximum ${MAX_CART_ITEMS} items allowed in cart`);
            return;
        }

        if (isInCart(item.id)) {
            console.log('Item already in cart:', item.id);
            return;
        }

        setItems(prev => [...prev, { ...item, addedAt: Date.now() }]);
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const clearCart = () => {
        if (window.confirm('Clear all items from cart?')) {
            setItems([]);
        }
    };

    const isInCart = (id: string): boolean => {
        return items.some(item => item.id === id);
    };

    const getCartCount = (): number => {
        return items.length;
    };

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            clearCart,
            isInCart,
            getCartCount
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
