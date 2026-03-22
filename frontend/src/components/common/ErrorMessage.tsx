import React, { useState } from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  title?: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  severity?: 'normal' | 'critical';
  variant?: 'default' | 'toast' | 'inline';
  onRetry?: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  details?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  className?: string;
  'data-testid'?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message,
  title,
  type = 'error',
  severity = 'normal',
  variant = 'default',
  onRetry,
  onDismiss,
  dismissible = false,
  details,
  actions = [],
  className = '',
  'data-testid': testId = 'error-message'
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const getIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '❌';
    }
  };

  const handleRetry = async () => {
    if (onRetry && !isRetrying) {
      setIsRetrying(true);
      try {
        await onRetry();
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const containerClasses = [
    'error-container',
    type,
    severity,
    variant,
    dismissible && 'dismissible',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={containerClasses}
      data-testid={testId}
      role="alert"
      aria-live="assertive"
    >
      {dismissible && onDismiss && (
        <button 
          className="error-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
      
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          {getIcon()}
        </div>
        
        <div className="error-text">
          {title && <h4 className="error-title">{title}</h4>}
          <p className="error-message">{message}</p>
          
          {details && (
            <div className="error-details">
              <button 
                className="error-details-toggle"
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              {showDetails && (
                <div className="error-details-content">
                  {details}
                </div>
              )}
            </div>
          )}
          
          <div className="error-actions">
            {onRetry && (
              <button 
                className={`retry-button ${isRetrying ? 'loading' : ''}`}
                onClick={handleRetry}
                disabled={isRetrying}
                aria-label={isRetrying ? 'Retrying...' : 'Try again'}
              >
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </button>
            )}
            
            {actions.map((action, index) => (
              <button
                key={index}
                className={`action-button ${action.variant || 'secondary'}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
            
            {dismissible && onDismiss && (
              <button 
                className="dismiss-button"
                onClick={onDismiss}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;