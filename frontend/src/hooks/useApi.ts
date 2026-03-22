import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { apiClient, apiUtils, ValidationError } from '../services/api';

// Enhanced error state interface
interface ErrorState {
  message: string;
  type: 'validation' | 'network' | 'server' | 'client' | 'unknown';
  isRetryable: boolean;
  actionSuggestion: string;
  field?: string;
}

// Enhanced generic hook for API operations with loading and error states
export const useApiOperation = <T>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (
    operation: () => Promise<T>, 
    options: {
      enableRetry?: boolean;
      onProgress?: (progress: number) => void;
      onRetry?: (attempt: number, delay: number, error: unknown) => void;
    } = {}
  ) => {
    const { enableRetry = true, onProgress, onRetry } = options;
    
    setLoading(true);
    setError(null);
    setProgress(0);
    
    // Create new abort controller for this operation
    abortControllerRef.current = new AbortController();
    
    try {
      const result = enableRetry 
        ? await apiUtils.withRetry(operation, {
            signal: abortControllerRef.current.signal,
            onProgress: ({ attempt, maxRetries }) => {
              const progressValue = (attempt / maxRetries) * 100;
              setProgress(progressValue);
              onProgress?.(progressValue);
            },
            onRetry: (attempt, delay, error) => {
              onRetry?.(attempt, delay, error);
            }
          })
        : await operation();
      
      setData(result);
      setProgress(100);
      return result;
    } catch (err) {
      // Don't set error if operation was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }
      
      const errorDetails = apiUtils.getErrorDetails(err);
      const errorState: ErrorState = {
        message: errorDetails.message,
        type: apiUtils.isValidationError(err) ? 'validation' :
              apiUtils.isNetworkError(err) ? 'network' :
              apiUtils.isServerError(err) ? 'server' :
              apiUtils.isClientError(err) ? 'client' : 'unknown',
        isRetryable: apiUtils.isRetryableError(err),
        actionSuggestion: apiUtils.getErrorActionSuggestion(err),
        field: errorDetails.field,
      };
      
      setError(errorState);
      setProgress(0);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async (operation: () => Promise<T>) => {
    if (error?.isRetryable) {
      return execute(operation, { enableRetry: false }); // Don't double-retry
    }
    throw new Error('Operation is not retryable');
  }, [error, execute]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort();
      setLoading(false);
      setProgress(0);
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setLoading(false);
    setError(null);
    setData(null);
    setProgress(0);
  }, [cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { 
    loading, 
    error, 
    data, 
    progress, 
    execute, 
    retry, 
    cancel, 
    reset,
    isRetryable: error?.isRetryable || false,
    actionSuggestion: error?.actionSuggestion,
    recoverySuggestions: error ? apiUtils.getRecoverySuggestions(error) : []
  };
};

// Hook for loading classifications
export const useClassifications = () => {
  const { dispatch } = useAppContext();
  const { loading, error, execute } = useApiOperation();

  const loadClassifications = useCallback(async () => {
    return execute(async () => {
      const response = await apiClient.getClassifications();
      dispatch({ type: 'SET_AVAILABLE_CLASSIFICATIONS', payload: response.systems });
      return response;
    });
  }, [execute, dispatch]);

  return { loading, error, loadClassifications };
};

// Hook for loading asteroids by classification
export const useAsteroidsByClassification = () => {
  const { dispatch } = useAppContext();
  const { loading, error, execute } = useApiOperation();

  const loadAsteroidsByClassification = useCallback(async (
    system: 'bus_demeo' | 'tholen',
    limit?: number,
    offset?: number
  ) => {
    return execute(async () => {
      const response = await apiClient.getAsteroidsByClassification(system, limit, offset);
      
      // Store asteroid data in context
      response.classes.forEach((classGroup: any) => {
        classGroup.asteroids.forEach((asteroid: any) => {
          dispatch({ 
            type: 'SET_ASTEROID_DATA', 
            payload: { id: asteroid.id, data: asteroid } 
          });
        });
      });
      
      return response;
    });
  }, [execute, dispatch]);

  return { loading, error, loadAsteroidsByClassification };
};

// Hook for loading individual asteroid data
export const useAsteroidData = () => {
  const { dispatch } = useAppContext();
  const { loading, error, execute } = useApiOperation();

  const loadAsteroid = useCallback(async (id: number) => {
    return execute(async () => {
      const response = await apiClient.getAsteroid(id);
      const asteroid = response?.asteroid;
      
      if (!asteroid) {
        throw new Error(`Asteroid ${id} not found`);
      }

      dispatch({ 
        type: 'SET_ASTEROID_DATA', 
        payload: { id: asteroid.id ?? id, data: asteroid } 
      });
      return asteroid;
    });
  }, [execute, dispatch]);

  const loadBatchAsteroids = useCallback(async (ids: number[]) => {
    return execute(async () => {
      const response = await apiClient.getBatchAsteroids(ids);
      const asteroids = response?.asteroids ?? [];
      
      asteroids.forEach((asteroid: any) => {
        if (asteroid?.id != null) {
          dispatch({ 
            type: 'SET_ASTEROID_DATA', 
            payload: { id: asteroid.id, data: asteroid } 
          });
        }
      });
      
      return asteroids;
    });
  }, [execute, dispatch]);

  return { loading, error, loadAsteroid, loadBatchAsteroids };
};

// Hook for loading spectral data
export const useSpectralData = () => {
  const { dispatch } = useAppContext();
  const { loading, error, execute } = useApiOperation();

  const loadSpectrum = useCallback(async (id: number) => {
    return execute(async () => {
      const response = await apiClient.getSpectrum(id);
      const spectrum = response?.spectrum;
      
      if (!spectrum) {
        throw new Error(`Spectrum for asteroid ${id} not found`);
      }

      const spectrumId = spectrum.asteroid_id ?? id;

      dispatch({ 
        type: 'SET_SPECTRAL_DATA', 
        payload: { id: spectrumId, data: spectrum } 
      });
      return spectrum;
    });
  }, [execute, dispatch]);

  const loadBatchSpectra = useCallback(async (ids: number[]) => {
    return execute(async () => {
      const response = await apiClient.getBatchSpectra(ids);
      const spectra = response?.spectra ?? [];
      
      spectra.forEach((spectrum: any, index: number) => {
        const spectrumId = spectrum?.asteroid_id ?? ids[index];
        if (spectrumId != null && spectrum) {
          dispatch({ 
            type: 'SET_SPECTRAL_DATA', 
            payload: { id: spectrumId, data: spectrum } 
          });
        }
      });
      
      return spectra;
    });
  }, [execute, dispatch]);

  return { loading, error, loadSpectrum, loadBatchSpectra };
};

// Hook for export operations
export const useExport = () => {
  const { loading, error, execute } = useApiOperation();

  const exportData = useCallback(async (
    asteroidIds: number[],
    format: 'csv' | 'json'
  ) => {
    return execute(async () => {
      const blob = await apiClient.exportData(asteroidIds, format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `asteroid_data.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return blob;
    });
  }, [execute]);

  const exportSpectrum = useCallback(async (
    asteroidIds: number[],
    includeRaw: boolean = false
  ) => {
    return execute(async () => {
      const blob = await apiClient.exportSpectrum(asteroidIds, includeRaw);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spectral_data.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return blob;
    });
  }, [execute]);

  return { loading, error, exportData, exportSpectrum };
};

// Hook for application initialization
export const useAppInitialization = () => {
  const { dispatch } = useAppContext();
  const { loading, error, execute } = useApiOperation();

  const initializeApp = useCallback(async () => {
    return execute(async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Check API health
        await apiClient.healthCheck();
        
        // Load initial classifications
        const classificationsResponse = await apiClient.getClassifications();
        dispatch({ 
          type: 'SET_AVAILABLE_CLASSIFICATIONS', 
          payload: classificationsResponse.systems 
        });
        
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: true };
      } catch (err) {
        const errorMessage = apiUtils.getErrorMessage(err);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        throw err;
      }
    });
  }, [execute, dispatch]);

  return { loading, error, initializeApp };
};
