import React, { useState } from 'react';
import { useCart, CartItem } from '../../contexts/CartContext';
import './AddToCartButton.css';

interface AddToCartButtonProps {
    item: CartItem;
    size?: 'small' | 'medium' | 'large';
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({ item, size = 'medium' }) => {
    const { addToCart, removeFromCart, isInCart } = useCart();
    const [showToast, setShowToast] = useState(false);
    const inCart = isInCart(item.id);

    const handleClick = () => {
        if (inCart) {
            removeFromCart(item.id);
            showToastMessage('Removed from cart');
        } else {
            addToCart(item);
            showToastMessage('Added to cart');
        }
    };

    const showToastMessage = (message: string) => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    return (
        <div className="add-to-cart-container">
            <button
                className={`add-to-cart-btn ${inCart ? 'in-cart' : ''} size-${size}`}
                onClick={handleClick}
                title={inCart ? 'Remove from cart' : 'Add to cart for comparison'}
            >
                <span className="icon">{inCart ? '✓' : '+'}</span>
                <span className="text">{inCart ? 'In Cart' : 'Add to Cart'}</span>
            </button>
            
            {showToast && (
                <div className="cart-toast">
                    {inCart ? 'Removed from cart' : 'Added to cart'}
                </div>
            )}
        </div>
    );
};

export default AddToCartButton;
