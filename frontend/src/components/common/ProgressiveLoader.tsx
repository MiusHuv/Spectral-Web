import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import './ProgressiveLoader.css';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error' | 'cancelled';
  progress?: number;
  error?: string;
  optional?: boolean;
}

interface ProgressiveLoaderProps {
  steps: ProgressStep[];
  onCancel?: () => void;
  onRetry?: (stepId: string) => void;
  onStepComplete?: (stepId: string, data?: any) => void;
  showDetailedProgress?: boolean;
  allowCancellation?: boolean;
  className?: string;
  'data-testid'?: string;
}

const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  steps,
  onCancel,
  onRetry,
  onStepComplete,
  showDetailedProgress = true,
  allowCancellation = true,
  className = '',
  'data-testid': testId = 'progressive-loader'
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const overallProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const currentStep = steps[currentStepIndex];
  const hasErrors = steps.some(step => step.status === 'error');
  const isComplete = steps.every(step => step.status === 'completed' || (step.optional && step.status === 'error'));

  useEffect(() => {
    // Update current step index based on step statuses
    const nextPendingIndex = steps.findIndex(step => 
      step.status === 'pending' || step.status === 'loading'
    );
    if (nextPendingIndex !== -1) {
      setCurrentStepIndex(nextPendingIndex);
    }
  }, [steps]);

  const handleCancel = useCallback(() => {
    if (onCancel && !isCancelled) {
      setIsCancelled(true);
      onCancel();
    }
  }, [onCancel, isCancelled]);

  const handleRetryStep = useCallback((stepId: string) => {
    if (onRetry) {
      onRetry(stepId);
    }
  }, [onRetry]);

  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return '✅';
      case 'loading':
        return '⏳';
      case 'error':
        return '❌';
      case 'cancelled':
        return '⏹️';
      default:
        return '⏸️';
    }
  };

  const getStepStatusText = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return 'Completed';
      case 'loading':
        return step.progress !== undefined ? `${Math.round(step.progress)}%` : 'Loading...';
      case 'error':
        return step.optional ? 'Failed (Optional)' : 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'pending':
        return 'Waiting';
      default:
        return 'Unknown';
    }
  };

  if (isComplete && !hasErrors) {
    return (
      <div className={`progressive-loader complete ${className}`} data-testid={testId}>
        <div className="completion-message">
          <div className="completion-icon">✅</div>
          <h3>Loading Complete</h3>
          <p>All data has been loaded successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`progressive-loader ${className}`} data-testid={testId}>
      {/* Overall Progress */}
      <div className="overall-progress">
        <div className="progress-header">
          <h3>Loading Data</h3>
          {allowCancellation && !isCancelled && (
            <button 
              className="cancel-button"
              onClick={handleCancel}
              aria-label="Cancel loading"
            >
              Cancel
            </button>
          )}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="progress-text">
            {completedSteps} of {totalSteps} steps completed
          </span>
        </div>
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className="current-step">
          <div className="step-header">
            <span className="step-icon">{getStepIcon(currentStep)}</span>
            <span className="step-label">{currentStep.label}</span>
            <span className="step-status">{getStepStatusText(currentStep)}</span>
          </div>
          
          {currentStep.status === 'loading' && (
            <div className="step-loading">
              <LoadingSpinner 
                size="small" 
                variant="inline"
                message=""
              />
              {currentStep.progress !== undefined && (
                <div className="step-progress-bar">
                  <div 
                    className="step-progress-fill"
                    style={{ width: `${currentStep.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
          
          {currentStep.status === 'error' && currentStep.error && (
            <ErrorMessage
              message={currentStep.error}
              type="error"
              variant="inline"
              onRetry={() => handleRetryStep(currentStep.id)}
              dismissible={false}
            />
          )}
        </div>
      )}

      {/* Detailed Steps (Optional) */}
      {showDetailedProgress && (
        <div className="detailed-steps">
          <h4>Progress Details</h4>
          <div className="steps-list">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`step-item ${step.status} ${index === currentStepIndex ? 'current' : ''}`}
              >
                <div className="step-indicator">
                  <span className="step-number">{index + 1}</span>
                  <span className="step-icon">{getStepIcon(step)}</span>
                </div>
                
                <div className="step-content">
                  <div className="step-title">
                    {step.label}
                    {step.optional && <span className="optional-badge">Optional</span>}
                  </div>
                  
                  <div className="step-status-text">
                    {getStepStatusText(step)}
                  </div>
                  
                  {step.status === 'error' && step.error && (
                    <div className="step-error">
                      <span className="error-text">{step.error}</span>
                      {onRetry && (
                        <button 
                          className="retry-step-button"
                          onClick={() => handleRetryStep(step.id)}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  
                  {step.status === 'loading' && step.progress !== undefined && (
                    <div className="step-progress">
                      <div className="mini-progress-bar">
                        <div 
                          className="mini-progress-fill"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                      <span className="progress-percentage">{Math.round(step.progress)}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary */}
      {hasErrors && (
        <div className="error-summary">
          <ErrorMessage
            title="Some steps failed"
            message={`${steps.filter(s => s.status === 'error').length} step(s) encountered errors. ${
              steps.filter(s => s.status === 'error' && !s.optional).length > 0 
                ? 'Some required data could not be loaded.' 
                : 'All required data was loaded successfully.'
            }`}
            type="warning"
            variant="inline"
            actions={[
              {
                label: 'Retry Failed Steps',
                onClick: () => {
                  steps
                    .filter(step => step.status === 'error')
                    .forEach(step => handleRetryStep(step.id));
                }
              }
            ]}
          />
        </div>
      )}

      {isCancelled && (
        <div className="cancellation-notice">
          <ErrorMessage
            title="Loading Cancelled"
            message="The loading process was cancelled by the user."
            type="info"
            variant="inline"
            dismissible={false}
          />
        </div>
      )}
    </div>
  );
};

export default ProgressiveLoader;