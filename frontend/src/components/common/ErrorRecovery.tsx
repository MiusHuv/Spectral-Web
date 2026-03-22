import React, { useState, useCallback } from 'react';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { apiUtils } from '../../services/api';
import './ErrorRecovery.css';

interface ErrorRecoveryProps {
  error: unknown;
  onRetry?: () => Promise<void> | void;
  onCancel?: () => void;
  onRecover?: (action: string) => Promise<void> | void;
  showDetailedSuggestions?: boolean;
  allowRetry?: boolean;
  retryLabel?: string;
  className?: string;
  'data-testid'?: string;
}

const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({
  error,
  onRetry,
  onCancel,
  onRecover,
  showDetailedSuggestions = true,
  allowRetry = true,
  retryLabel = 'Try Again',
  className = '',
  'data-testid': testId = 'error-recovery'
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRecovering, setIsRecovering] = useState<string | null>(null);

  const errorDetails = apiUtils.getErrorDetails(error);
  const isRetryable = apiUtils.isRetryableError(error);
  const actionSuggestion = apiUtils.getErrorActionSuggestion(error);
  const recoverySuggestions = apiUtils.getRecoverySuggestions(error);

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying]);

  const handleRecover = useCallback(async (action: string) => {
    if (!onRecover || isRecovering) return;

    setIsRecovering(action);
    try {
      await onRecover(action);
    } catch (recoverError) {
      console.error('Recovery action failed:', recoverError);
    } finally {
      setIsRecovering(null);
    }
  }, [onRecover, isRecovering]);

  const getErrorIcon = () => {
    if (apiUtils.isNetworkError(error)) return '🌐';
    if (apiUtils.isServerError(error)) return '🔧';
    if (apiUtils.isValidationError(error)) return '⚠️';
    return '❌';
  };

  const getErrorTitle = () => {
    if (apiUtils.isValidationError(error)) return 'Input Error';
    if (apiUtils.isNetworkError(error)) return 'Connection Problem';
    if (apiUtils.isServerError(error)) return 'Server Issue';
    return 'Something Went Wrong';
  };

  const getErrorDescription = () => {
    if (apiUtils.isValidationError(error)) {
      return 'There was an issue with the data you provided. Please check your input and try again.';
    }
    if (apiUtils.isNetworkError(error)) {
      return 'Unable to connect to the server. This might be due to network issues or the server being temporarily unavailable.';
    }
    if (apiUtils.isServerError(error)) {
      return 'The server encountered an error while processing your request. This is usually temporary.';
    }
    return 'An unexpected error occurred. We\'re working to resolve these issues.';
  };

  return (
    <div className={`error-recovery ${className}`} data-testid={testId}>
      <div className="error-recovery-header">
        <div className="error-icon">{getErrorIcon()}</div>
        <div className="error-content">
          <h3 className="error-title">{getErrorTitle()}</h3>
          <p className="error-description">{getErrorDescription()}</p>
          <p className="error-message">{errorDetails.message}</p>
        </div>
      </div>

      {/* Action Suggestion */}
      <div className="action-suggestion">
        <h4>What you can do:</h4>
        <p>{actionSuggestion}</p>
      </div>

      {/* Primary Actions */}
      <div className="primary-actions">
        {allowRetry && isRetryable && onRetry && (
          <button
            className={`retry-button ${isRetrying ? 'loading' : ''}`}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <LoadingSpinner size="small" variant="inline" message="" />
                Retrying...
              </>
            ) : (
              retryLabel
            )}
          </button>
        )}

        {onCancel && (
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      {/* Detailed Recovery Suggestions */}
      {showDetailedSuggestions && recoverySuggestions.length > 0 && (
        <div className="recovery-suggestions">
          <h4>Recovery Options:</h4>
          <div className="suggestions-list">
            {recoverySuggestions.map((suggestion, index) => (
              <div 
                key={index}
                className={`suggestion-item priority-${suggestion.priority}`}
              >
                <div className="suggestion-content">
                  <h5 className="suggestion-action">{suggestion.action}</h5>
                  <p className="suggestion-description">{suggestion.description}</p>
                </div>
                
                {onRecover && (
                  <button
                    className={`suggestion-button ${isRecovering === suggestion.action ? 'loading' : ''}`}
                    onClick={() => handleRecover(suggestion.action)}
                    disabled={isRecovering !== null}
                  >
                    {isRecovering === suggestion.action ? (
                      <LoadingSpinner size="small" variant="inline" message="" />
                    ) : (
                      'Try This'
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Details (Collapsible) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="technical-details">
          <summary>Technical Details</summary>
          <div className="details-content">
            <div className="detail-item">
              <strong>Error Type:</strong> {errorDetails.type}
            </div>
            {errorDetails.status && (
              <div className="detail-item">
                <strong>Status Code:</strong> {errorDetails.status}
              </div>
            )}
            {errorDetails.timestamp && (
              <div className="detail-item">
                <strong>Timestamp:</strong> {errorDetails.timestamp.toISOString()}
              </div>
            )}
            {errorDetails.field && (
              <div className="detail-item">
                <strong>Field:</strong> {errorDetails.field}
              </div>
            )}
            <div className="detail-item">
              <strong>Retryable:</strong> {errorDetails.isRetryable ? 'Yes' : 'No'}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};

export default ErrorRecovery;