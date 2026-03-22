import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ErrorRecovery from '../components/common/ErrorRecovery';
import ProgressiveLoader from '../components/common/ProgressiveLoader';
import { useProgressiveLoader } from '../hooks/useProgressiveLoader';
import { apiUtils } from '../services/api';

// Mock the API utilities
vi.mock('../services/api', () => ({
  apiUtils: {
    getErrorDetails: vi.fn(),
    isRetryableError: vi.fn(),
    getErrorActionSuggestion: vi.fn(),
    getRecoverySuggestions: vi.fn(),
    isNetworkError: vi.fn(),
    isServerError: vi.fn(),
    isValidationError: vi.fn(),
    withRetry: vi.fn(),
    withGracefulDegradation: vi.fn(),
    loadPartialData: vi.fn()
  }
}));

describe('Enhanced Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ErrorRecovery Component', () => {
    it('should display network error with appropriate suggestions', () => {
      const networkError = new Error('Network error');
      
      (apiUtils.getErrorDetails as any).mockReturnValue({
        type: 'NetworkError',
        message: 'Network connection failed',
        isRetryable: true
      });
      
      // Reset all error type checks first
      (apiUtils.isValidationError as any).mockReturnValue(false);
      (apiUtils.isNetworkError as any).mockReturnValue(true);
      (apiUtils.isServerError as any).mockReturnValue(false);
      (apiUtils.isRetryableError as any).mockReturnValue(true);
      (apiUtils.getErrorActionSuggestion as any).mockReturnValue(
        'Check your internet connection and try again.'
      );
      (apiUtils.getRecoverySuggestions as any).mockReturnValue([
        {
          action: 'Check Connection',
          description: 'Verify your internet connection',
          priority: 'high' as const
        },
        {
          action: 'Refresh Page',
          description: 'Reload the application',
          priority: 'medium' as const
        }
      ]);

      const onRetry = vi.fn();
      
      render(
        <ErrorRecovery
          error={networkError}
          onRetry={onRetry}
          data-testid="error-recovery"
        />
      );

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument();
      expect(screen.getByText('Check Connection')).toBeInTheDocument();
      expect(screen.getByText('Refresh Page')).toBeInTheDocument();
      
      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should display server error with recovery options', () => {
      const serverError = new Error('Server error');
      
      (apiUtils.getErrorDetails as any).mockReturnValue({
        type: 'ApiError',
        message: 'Internal server error',
        status: 500,
        isRetryable: true
      });
      
      // Reset all error type checks first
      (apiUtils.isValidationError as any).mockReturnValue(false);
      (apiUtils.isNetworkError as any).mockReturnValue(false);
      (apiUtils.isServerError as any).mockReturnValue(true);
      (apiUtils.isRetryableError as any).mockReturnValue(true);
      (apiUtils.getErrorActionSuggestion as any).mockReturnValue(
        'The server is experiencing issues. Please try again in a few moments.'
      );
      (apiUtils.getRecoverySuggestions as any).mockReturnValue([
        {
          action: 'Retry Request',
          description: 'Try the operation again',
          priority: 'high' as const
        },
        {
          action: 'Reduce Data',
          description: 'Select fewer items to reduce load',
          priority: 'medium' as const
        }
      ]);

      const onRecover = vi.fn();
      
      render(
        <ErrorRecovery
          error={serverError}
          onRecover={onRecover}
          showDetailedSuggestions={true}
        />
      );

      expect(screen.getByText('Server Issue')).toBeInTheDocument();
      expect(screen.getByText('Retry Request')).toBeInTheDocument();
      expect(screen.getByText('Reduce Data')).toBeInTheDocument();
      
      const recoverButton = screen.getAllByText('Try This')[0];
      fireEvent.click(recoverButton);
      expect(onRecover).toHaveBeenCalledWith('Retry Request');
    });

    it('should handle validation errors appropriately', () => {
      const validationError = new Error('Validation failed');
      
      (apiUtils.getErrorDetails as any).mockReturnValue({
        type: 'ValidationError',
        message: 'Invalid input format',
        field: 'asteroidIds',
        isRetryable: false
      });
      
      // Reset all error type checks first
      (apiUtils.isValidationError as any).mockReturnValue(true);
      (apiUtils.isNetworkError as any).mockReturnValue(false);
      (apiUtils.isServerError as any).mockReturnValue(false);
      (apiUtils.isRetryableError as any).mockReturnValue(false);
      (apiUtils.getErrorActionSuggestion as any).mockReturnValue(
        'Please check the asteroidIds field and ensure it meets the requirements.'
      );
      (apiUtils.getRecoverySuggestions as any).mockReturnValue([
        {
          action: 'Check Input',
          description: 'Verify the data format',
          priority: 'high' as const
        }
      ]);

      render(
        <ErrorRecovery
          error={validationError}
          allowRetry={false}
        />
      );

      expect(screen.getByText('Input Error')).toBeInTheDocument();
      expect(screen.getByText('Please check the asteroidIds field and ensure it meets the requirements.')).toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });

  describe('ProgressiveLoader Component', () => {
    it('should display loading steps with progress', () => {
      const steps = [
        {
          id: 'step1',
          label: 'Loading classifications',
          status: 'completed' as const,
          progress: 100
        },
        {
          id: 'step2',
          label: 'Loading asteroids',
          status: 'loading' as const,
          progress: 60
        },
        {
          id: 'step3',
          label: 'Loading spectral data',
          status: 'pending' as const
        }
      ];

      const onCancel = vi.fn();
      
      render(
        <ProgressiveLoader
          steps={steps}
          onCancel={onCancel}
          showDetailedProgress={true}
        />
      );

      expect(screen.getByText('Loading Data')).toBeInTheDocument();
      expect(screen.getByText('Loading classifications')).toBeInTheDocument();
      expect(screen.getAllByText('Loading asteroids')).toHaveLength(2); // Current step and detailed step
      expect(screen.getByText('Loading spectral data')).toBeInTheDocument();
      expect(screen.getByText('1 of 3 steps completed')).toBeInTheDocument();
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle step errors with retry options', () => {
      const steps = [
        {
          id: 'step1',
          label: 'Loading data',
          status: 'error' as const,
          error: 'Network connection failed'
        }
      ];

      const onRetry = vi.fn();
      
      render(
        <ProgressiveLoader
          steps={steps}
          onRetry={onRetry}
          showDetailedProgress={true}
        />
      );

      expect(screen.getAllByText('Network connection failed')).toHaveLength(2); // Error message and step error
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledWith('step1');
    });

    it('should show completion state when all steps are done', () => {
      const steps = [
        {
          id: 'step1',
          label: 'Loading data',
          status: 'completed' as const
        },
        {
          id: 'step2',
          label: 'Processing data',
          status: 'completed' as const
        }
      ];

      render(
        <ProgressiveLoader
          steps={steps}
          showDetailedProgress={false}
        />
      );

      expect(screen.getByText('Loading Complete')).toBeInTheDocument();
      expect(screen.getByText('All data has been loaded successfully.')).toBeInTheDocument();
    });
  });

  describe('useProgressiveLoader Hook', () => {
    const TestComponent: React.FC<{ operations: any[] }> = ({ operations }) => {
      const {
        steps,
        isLoading,
        startLoading,
        cancelLoading,
        retryStep,
        getStats
      } = useProgressiveLoader({
        onStepComplete: vi.fn(),
        onStepError: vi.fn(),
        onAllComplete: vi.fn()
      });

      const stats = getStats();

      return (
        <div>
          <div data-testid="loading-status">{isLoading ? 'Loading' : 'Idle'}</div>
          <div data-testid="progress">{stats.progress}%</div>
          <div data-testid="completed">{stats.completed}</div>
          <div data-testid="failed">{stats.failed}</div>
          <button onClick={() => startLoading(operations)}>Start</button>
          <button onClick={cancelLoading}>Cancel</button>
          {steps.map(step => (
            <div key={step.id} data-testid={`step-${step.id}`}>
              {step.label}: {step.status}
              {step.status === 'error' && (
                <button onClick={() => retryStep(step.id, operations.find(op => op.id === step.id)?.operation)}>
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      );
    };

    it('should manage loading state correctly', async () => {
      const operations = [
        {
          id: 'op1',
          label: 'Operation 1',
          operation: vi.fn().mockResolvedValue('result1'),
          required: true
        },
        {
          id: 'op2',
          label: 'Operation 2',
          operation: vi.fn().mockResolvedValue('result2'),
          required: false
        }
      ];

      (apiUtils.withRetry as any).mockImplementation((op: any) => op());

      render(<TestComponent operations={operations} />);

      expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
      expect(screen.getByTestId('progress')).toHaveTextContent('0%');

      fireEvent.click(screen.getByText('Start'));

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
        expect(screen.getByTestId('completed')).toHaveTextContent('2');
        expect(screen.getByTestId('progress')).toHaveTextContent('100%');
      });
    });

    it('should handle cancellation correctly', async () => {
      const operations = [
        {
          id: 'op1',
          label: 'Operation 1',
          operation: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000))),
          required: true
        }
      ];

      render(<TestComponent operations={operations} />);

      fireEvent.click(screen.getByText('Start'));
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('Idle');
      });
    });
  });

  describe('API Utilities', () => {
    it('should provide graceful degradation', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = 'fallback value';

      (apiUtils.withGracefulDegradation as any).mockImplementation(async (op: any, fb: any) => {
        try {
          return await op();
        } catch {
          return fb;
        }
      });

      const result = await apiUtils.withGracefulDegradation(operation, fallback);
      expect(result).toBe(fallback);
    });

    it('should handle partial data loading', async () => {
      const operations = [
        {
          id: 'op1',
          operation: vi.fn().mockResolvedValue('success'),
          required: true
        },
        {
          id: 'op2',
          operation: vi.fn().mockRejectedValue(new Error('failed')),
          required: false
        }
      ];

      (apiUtils.loadPartialData as any).mockResolvedValue({
        results: [
          { id: 'op1', data: 'success', error: null },
          { id: 'op2', data: null, error: new Error('failed') }
        ],
        successCount: 1,
        errorCount: 1,
        hasRequiredFailures: false
      });

      const result = await apiUtils.loadPartialData(operations);
      
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.hasRequiredFailures).toBe(false);
    });
  });
});