import React from 'react';
import './ExportProgressIndicator.css';

export interface ExportProgressIndicatorProps {
    status: string;
    isExporting: boolean;
    error: string | null;
}

const ExportProgressIndicator: React.FC<ExportProgressIndicatorProps> = ({
    status,
    isExporting,
    error
}) => {
    const getStatusIcon = () => {
        if (error) {
            return (
                <svg className="status-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            );
        }

        if (!isExporting && status.includes('complete')) {
            return (
                <svg className="status-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        }

        return (
            <div className="status-icon loading">
                <div className="spinner"></div>
            </div>
        );
    };

    const getProgressSteps = () => {
        const steps = [
            { label: 'Preparing export', key: 'preparing' },
            { label: 'Converting data', key: 'converting' },
            { label: 'Packaging files', key: 'packaging' },
            { label: 'Downloading', key: 'downloading' }
        ];

        const currentStepIndex = steps.findIndex(step => 
            status.toLowerCase().includes(step.key)
        );

        return steps.map((step, index) => ({
            ...step,
            completed: index < currentStepIndex || (!isExporting && status.includes('complete')),
            active: index === currentStepIndex && isExporting,
            pending: index > currentStepIndex
        }));
    };

    const progressSteps = getProgressSteps();

    return (
        <div className="export-progress-indicator">
            <div className="progress-content">
                {/* Status Icon */}
                <div className="progress-icon-container">
                    {getStatusIcon()}
                </div>

                {/* Status Message */}
                <div className="progress-message">
                    {error ? (
                        <>
                            <h3 className="progress-title error">Export Failed</h3>
                            <p className="progress-description error">{error}</p>
                        </>
                    ) : !isExporting && status.includes('complete') ? (
                        <>
                            <h3 className="progress-title success">Export Complete!</h3>
                            <p className="progress-description">Your download should begin automatically.</p>
                        </>
                    ) : (
                        <>
                            <h3 className="progress-title">Exporting Data...</h3>
                            <p className="progress-description">{status}</p>
                        </>
                    )}
                </div>

                {/* Progress Steps */}
                {isExporting && !error && (
                    <div className="progress-steps">
                        {progressSteps.map((step, index) => (
                            <div key={step.key} className="progress-step-item">
                                <div className={`step-indicator ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''} ${step.pending ? 'pending' : ''}`}>
                                    {step.completed ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>
                                <div className="step-label">{step.label}</div>
                                {index < progressSteps.length - 1 && (
                                    <div className={`step-connector ${step.completed ? 'completed' : ''}`}></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Progress Bar */}
                {isExporting && !error && (
                    <div className="progress-bar-container">
                        <div className="progress-bar">
                            <div className="progress-bar-fill"></div>
                        </div>
                    </div>
                )}

                {/* Success Animation */}
                {!isExporting && status.includes('complete') && !error && (
                    <div className="success-animation">
                        <div className="checkmark-circle">
                            <svg className="checkmark" viewBox="0 0 52 52">
                                <circle className="checkmark-circle-path" cx="26" cy="26" r="25" fill="none" />
                                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Error Details */}
                {error && (
                    <div className="error-details">
                        <p className="error-hint">
                            Please try again or contact support if the problem persists.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExportProgressIndicator;
