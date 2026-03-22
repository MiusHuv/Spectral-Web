import { useState, useCallback, useRef, useEffect } from 'react';
import { apiUtils } from '../services/api';

interface LoadingStep {
  id: string;
  label: string;
  operation: () => Promise<any>;
  required?: boolean;
  retryable?: boolean;
}

interface StepState {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error' | 'cancelled';
  progress?: number;
  error?: string;
  optional?: boolean;
  data?: any;
}

interface UseProgressiveLoaderOptions {
  maxRetries?: number;
  retryDelay?: number;
  onStepComplete?: (stepId: string, data: any) => void;
  onStepError?: (stepId: string, error: unknown) => void;
  onAllComplete?: (results: Array<{ id: string; data: any; error?: unknown }>) => void;
  onCancel?: () => void;
}

export const useProgressiveLoader = (options: UseProgressiveLoaderOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onStepComplete,
    onStepError,
    onAllComplete,
    onCancel
  } = options;

  const [steps, setSteps] = useState<StepState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountsRef = useRef<Map<string, number>>(new Map());

  // Initialize steps
  const initializeSteps = useCallback((loadingSteps: LoadingStep[]) => {
    const initialSteps: StepState[] = loadingSteps.map(step => ({
      id: step.id,
      label: step.label,
      status: 'pending' as const,
      optional: !step.required,
    }));
    
    setSteps(initialSteps);
    setIsCancelled(false);
    retryCountsRef.current.clear();
  }, []);

  // Update step status
  const updateStep = useCallback((stepId: string, updates: Partial<StepState>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  // Execute a single step with retry logic
  const executeStep = useCallback(async (
    stepId: string, 
    operation: () => Promise<any>,
    retryable: boolean = true
  ): Promise<{ success: boolean; data?: any; error?: unknown }> => {
    if (isCancelled || abortControllerRef.current?.signal.aborted) {
      updateStep(stepId, { status: 'cancelled' });
      return { success: false };
    }

    updateStep(stepId, { status: 'loading', progress: 0 });

    const retryCount = retryCountsRef.current.get(stepId) || 0;
    
    try {
      // Execute operation with retry logic
      const result = await apiUtils.withRetry(
        operation,
        {
          maxRetries: retryable ? maxRetries : 1,
          baseDelay: retryDelay,
          signal: abortControllerRef.current?.signal,
          onProgress: ({ attempt, maxRetries: max }) => {
            const progress = (attempt / max) * 100;
            updateStep(stepId, { progress });
          },
          onRetry: (attempt, delay, error) => {
            retryCountsRef.current.set(stepId, attempt);
            console.log(`Retrying step ${stepId}, attempt ${attempt}`);
          }
        }
      );

      updateStep(stepId, { 
        status: 'completed', 
        progress: 100, 
        data: result,
        error: undefined 
      });
      
      onStepComplete?.(stepId, result);
      return { success: true, data: result };

    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error);
      
      updateStep(stepId, { 
        status: 'error', 
        error: errorMessage,
        progress: undefined 
      });
      
      onStepError?.(stepId, error);
      return { success: false, error };
    }
  }, [isCancelled, maxRetries, retryDelay, updateStep, onStepComplete, onStepError]);

  // Start loading process
  const startLoading = useCallback(async (loadingSteps: LoadingStep[]) => {
    if (isLoading) {
      console.warn('Loading already in progress');
      return;
    }

    setIsLoading(true);
    setIsCancelled(false);
    abortControllerRef.current = new AbortController();
    
    initializeSteps(loadingSteps);

    const results: Array<{ id: string; data: any; error?: unknown }> = [];
    let hasRequiredFailures = false;

    // Execute steps sequentially
    for (const step of loadingSteps) {
      if (isCancelled || abortControllerRef.current.signal.aborted) {
        break;
      }

      const result = await executeStep(step.id, step.operation, step.retryable);
      
      results.push({
        id: step.id,
        data: result.data,
        error: result.error
      });

      // Check if a required step failed
      if (!result.success && step.required) {
        hasRequiredFailures = true;
        break;
      }
    }

    setIsLoading(false);

    // Call completion callback if not cancelled
    if (!isCancelled && !abortControllerRef.current.signal.aborted) {
      onAllComplete?.(results);
    }

    return {
      results,
      hasRequiredFailures,
      cancelled: isCancelled || abortControllerRef.current.signal.aborted
    };
  }, [isLoading, isCancelled, initializeSteps, executeStep, onAllComplete]);

  // Cancel loading
  const cancelLoading = useCallback(() => {
    if (!isLoading) {
      return;
    }

    setIsCancelled(true);
    abortControllerRef.current?.abort();
    
    // Update all pending/loading steps to cancelled
    setSteps(prev => prev.map(step => 
      step.status === 'pending' || step.status === 'loading'
        ? { ...step, status: 'cancelled' as const }
        : step
    ));

    setIsLoading(false);
    onCancel?.();
  }, [isLoading, onCancel]);

  // Retry a specific step
  const retryStep = useCallback(async (stepId: string, operation: () => Promise<any>) => {
    if (isLoading) {
      console.warn('Cannot retry step while loading is in progress');
      return;
    }

    // Reset retry count for this step
    retryCountsRef.current.delete(stepId);
    
    // Reset step status
    updateStep(stepId, { 
      status: 'pending', 
      error: undefined, 
      progress: undefined 
    });

    // Execute the step
    const result = await executeStep(stepId, operation, true);
    return result;
  }, [isLoading, updateStep, executeStep]);

  // Retry all failed steps
  const retryFailedSteps = useCallback(async (loadingSteps: LoadingStep[]) => {
    if (isLoading) {
      console.warn('Cannot retry while loading is in progress');
      return;
    }

    const failedSteps = steps.filter(step => step.status === 'error');
    if (failedSteps.length === 0) {
      return;
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const results: Array<{ id: string; data: any; error?: unknown }> = [];

    for (const failedStep of failedSteps) {
      const loadingStep = loadingSteps.find(ls => ls.id === failedStep.id);
      if (!loadingStep) continue;

      if (isCancelled || abortControllerRef.current.signal.aborted) {
        break;
      }

      // Reset retry count
      retryCountsRef.current.delete(failedStep.id);
      
      const result = await executeStep(failedStep.id, loadingStep.operation, loadingStep.retryable);
      results.push({
        id: failedStep.id,
        data: result.data,
        error: result.error
      });
    }

    setIsLoading(false);
    return results;
  }, [isLoading, steps, isCancelled, executeStep]);

  // Get loading statistics
  const getStats = useCallback(() => {
    const total = steps.length;
    const completed = steps.filter(s => s.status === 'completed').length;
    const failed = steps.filter(s => s.status === 'error').length;
    const loading = steps.filter(s => s.status === 'loading').length;
    const cancelled = steps.filter(s => s.status === 'cancelled').length;
    const pending = steps.filter(s => s.status === 'pending').length;

    return {
      total,
      completed,
      failed,
      loading,
      cancelled,
      pending,
      progress: total > 0 ? (completed / total) * 100 : 0,
      isComplete: total > 0 && completed === total,
      hasErrors: failed > 0,
      hasRequiredErrors: steps.some(s => s.status === 'error' && !s.optional)
    };
  }, [steps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    steps,
    isLoading,
    isCancelled,
    startLoading,
    cancelLoading,
    retryStep,
    retryFailedSteps,
    getStats,
    updateStep
  };
};

export default useProgressiveLoader;