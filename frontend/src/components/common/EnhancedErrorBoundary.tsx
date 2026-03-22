import React, { Component, ErrorInfo, ReactNode } from 'react';
import './EnhancedErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, context: ErrorContext) => void;
  showDiagnostics?: boolean;
  enableLogging?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  context: ErrorContext | null;
  errorId: string | null;
}

interface ErrorContext {
  timestamp: string;
  userAgent: string;
  url: string;
  viewport: { width: number; height: number };
  selectedAsteroids?: number[];
  filters?: any;
  componentStack?: string;
  memoryUsage?: any;
}

class EnhancedErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      context: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.captureErrorContext();

    this.setState({
      errorInfo,
      context
    });

    // Log error with context
    if (this.props.enableLogging !== false) {
      this.logError(error, errorInfo, context);
    }

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo, context);
    }
  }

  private captureErrorContext(): ErrorContext {
    const context: ErrorContext = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    // Try to capture current app state if available
    try {
      // Access app context through window or other means
      const appState = (window as any).__APP_STATE__;
      if (appState) {
        context.selectedAsteroids = appState.selectedAsteroids;
        context.filters = appState.filters;
      }
    } catch (e) {
      // Ignore errors in context capture
    }

    // Capture memory usage if available
    try {
      if ('memory' in performance) {
        context.memoryUsage = (performance as any).memory;
      }
    } catch (e) {
      // Ignore errors in memory capture
    }

    return context;
  }

  private logError(error: Error, errorInfo: ErrorInfo, context: ErrorContext) {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      context,
      retryCount: this.retryCount,
      timestamp: new Date().toISOString()
    };

    console.group('🚨 Enhanced Error Boundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.table(context);
    console.groupEnd();

    // Send to external logging service if available
    try {
      if ((window as any).errorLogger) {
        (window as any).errorLogger.log(logData);
      }
    } catch (e) {
      // Ignore logging service errors
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        context: null,
        errorId: null
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private exportDiagnostics = () => {
    if (!this.state.context || !this.state.error) return;

    const diagnostics = {
      errorId: this.state.errorId,
      error: {
        name: this.state.error.name,
        message: this.state.error.message,
        stack: this.state.error.stack
      },
      context: this.state.context,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.retryCount
    };

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-diagnostics-${this.state.errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="enhanced-error-boundary">
          <div className="error-container">
            <div className="error-header">
              <h2 className="error-title">⚠️ Something went wrong</h2>
              <p className="error-subtitle">
                An unexpected error occurred while rendering this component.
              </p>
            </div>

            <div className="error-actions">
              {this.retryCount < this.maxRetries && (
                <button
                  className="error-btn retry-btn"
                  onClick={this.handleRetry}
                >
                  🔄 Retry ({this.maxRetries - this.retryCount} attempts left)
                </button>
              )}

              <button
                className="error-btn reload-btn"
                onClick={this.handleReload}
              >
                🔃 Reload Page
              </button>

              {this.props.showDiagnostics !== false && (
                <button
                  className="error-btn diagnostics-btn"
                  onClick={this.exportDiagnostics}
                >
                  📊 Export Diagnostics
                </button>
              )}
            </div>

            {this.props.showDiagnostics !== false && this.state.context && (
              <div className="error-diagnostics">
                <details className="diagnostics-details">
                  <summary className="diagnostics-summary">
                    🔍 View Technical Details
                  </summary>
                  <div className="diagnostics-content">
                    <div className="diagnostics-section">
                      <h4>Error Information</h4>
                      <div className="diagnostics-item">
                        <strong>Error ID:</strong> {this.state.errorId}
                      </div>
                      <div className="diagnostics-item">
                        <strong>Error:</strong> {this.state.error?.name}: {this.state.error?.message}
                      </div>
                      <div className="diagnostics-item">
                        <strong>Timestamp:</strong> {this.state.context.timestamp}
                      </div>
                      <div className="diagnostics-item">
                        <strong>URL:</strong> {this.state.context.url}
                      </div>
                      <div className="diagnostics-item">
                        <strong>Viewport:</strong> {this.state.context.viewport.width} × {this.state.context.viewport.height}
                      </div>
                    </div>

                    {this.state.context.selectedAsteroids && (
                      <div className="diagnostics-section">
                        <h4>Application State</h4>
                        <div className="diagnostics-item">
                          <strong>Selected Asteroids:</strong> {this.state.context.selectedAsteroids.length} items
                        </div>
                      </div>
                    )}

                    <div className="diagnostics-section">
                      <h4>Component Stack</h4>
                      <pre className="component-stack">
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            )}

            <div className="error-footer">
              <p className="error-help">
                If this problem persists, please report it with the error ID above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;
