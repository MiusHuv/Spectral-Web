import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  variant?: 'spinner' | 'dots' | 'skeleton' | 'inline';
  showProgress?: boolean;
  className?: string;
  'data-testid'?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = 'Loading...',
  variant = 'spinner',
  showProgress = false,
  className = '',
  'data-testid': testId = 'loading-spinner'
}) => {
  const containerClass = variant === 'inline' ? 'loading-inline' : 'loading-container';
  const spinnerClass = `loading-spinner ${size} ${variant}`;

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className={spinnerClass}>
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      
      case 'skeleton':
        return (
          <div className="loading-skeleton">
            <div className="skeleton-line long"></div>
            <div className="skeleton-line medium"></div>
            <div className="skeleton-line short"></div>
            <div className="skeleton-line long"></div>
          </div>
        );
      
      case 'inline':
        return (
          <div className={spinnerClass}>
            <div className="spinner"></div>
          </div>
        );
      
      default:
        return (
          <div className={spinnerClass}>
            <div className="spinner"></div>
          </div>
        );
    }
  };

  return (
    <div 
      className={`${containerClass} ${className}`}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="fade-in">
        {renderSpinner()}
        
        {showProgress && variant !== 'skeleton' && (
          <div className="loading-progress">
            <div className="loading-progress-bar"></div>
          </div>
        )}
        
        {message && variant !== 'skeleton' && (
          <p className={`loading-message ${size}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;