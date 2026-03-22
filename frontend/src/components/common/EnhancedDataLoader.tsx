import React, { useState, useCallback, useEffect } from 'react';
import ProgressiveLoader from './ProgressiveLoader';
import ErrorRecovery from './ErrorRecovery';
import { useProgressiveLoader } from '../../hooks/useProgressiveLoader';
import { useApiOperation } from '../../hooks/useApi';
import { apiClient, apiUtils } from '../../services/api';

interface EnhancedDataLoaderProps {
  onDataLoaded?: (data: {
    classifications: any;
    asteroids: any[];
    spectra: any[];
  }) => void;
  onError?: (error: unknown) => void;
  selectedClassification?: string;
  selectedSystem?: 'bus_demeo' | 'tholen';
  maxAsteroids?: number;
  className?: string;
}

const EnhancedDataLoader: React.FC<EnhancedDataLoaderProps> = ({
  onDataLoaded,
  onError,
  selectedClassification,
  selectedSystem = 'bus_demeo',
  maxAsteroids = 100,
  className = ''
}) => {
  const [loadedData, setLoadedData] = useState<any>(null);
  const [criticalError, setCriticalError] = useState<unknown>(null);

  const {
    steps,
    isLoading,
    startLoading,
    cancelLoading,
    retryStep,
    retryFailedSteps,
    getStats
  } = useProgressiveLoader({
    maxRetries: 3,
    retryDelay: 1000,
    onStepComplete: (stepId, data) => {
      console.log(`Step ${stepId} completed:`, data);
    },
    onStepError: (stepId, error) => {
      console.error(`Step ${stepId} failed:`, error);
      onError?.(error);
    },
    onAllComplete: (results) => {
      const successfulResults = results.filter(r => r.data && !r.error);
      if (successfulResults.length > 0) {
        const combinedData = {
          classifications: successfulResults.find(r => r.id === 'classifications')?.data,
          asteroids: successfulResults.find(r => r.id === 'asteroids')?.data || [],
          spectra: successfulResults.find(r => r.id === 'spectra')?.data || []
        };
        setLoadedData(combinedData);
        onDataLoaded?.(combinedData);
      }
    },
    onCancel: () => {
      console.log('Data loading cancelled by user');
    }
  });

  // Define loading operations
  const createLoadingOperations = useCallback(() => {
    const operations = [
      {
        id: 'classifications',
        label: 'Loading classification metadata',
        operation: async () => {
          if (selectedSystem) {
            return await apiClient.getClassificationMetadata(selectedSystem);
          }
          return await apiClient.getClassifications();
        },
        required: true,
        retryable: true
      }
    ];

    // Add asteroid loading if classification is selected
    if (selectedClassification && selectedSystem) {
      operations.push({
        id: 'asteroids',
        label: `Loading asteroids for ${selectedClassification}`,
        operation: async () => {
          return await apiClient.getClassificationAsteroids(
            selectedSystem,
            selectedClassification,
            maxAsteroids,
            0
          );
        },
        required: true,
        retryable: true
      });

      // Add spectral data loading (optional)
      operations.push({
        id: 'spectra',
        label: 'Loading spectral data',
        operation: async () => {
          // First get asteroids, then load their spectra
          const asteroidsResult = await apiClient.getClassificationAsteroids(
            selectedSystem,
            selectedClassification,
            Math.min(maxAsteroids, 20), // Limit spectral data loading
            0
          );
          
          const asteroidIds = asteroidsResult.asteroids
            .filter(a => a.has_spectral_data)
            .map(a => a.id)
            .slice(0, 10); // Further limit for performance

          if (asteroidIds.length === 0) {
            return { spectra: [] };
          }

          return await apiClient.getBatchSpectra(asteroidIds);
        },
        required: false, // Spectral data is optional
        retryable: true
      });
    }

    return operations;
  }, [selectedClassification, selectedSystem, maxAsteroids]);

  // Start loading when dependencies change
  useEffect(() => {
    if (selectedSystem) {
      const operations = createLoadingOperations();
      startLoading(operations);
    }
  }, [selectedSystem, selectedClassification, maxAsteroids, startLoading, createLoadingOperations]);

  // Handle critical errors that prevent any loading
  const handleCriticalError = useCallback((error: unknown) => {
    setCriticalError(error);
    onError?.(error);
  }, [onError]);

  // Retry operations with graceful degradation
  const handleRetryWithDegradation = useCallback(async () => {
    try {
      setCriticalError(null);
      
      // Use graceful degradation for partial loading
      const operations = createLoadingOperations();
      
      const partialResults = await apiUtils.loadPartialData(
        operations.map(op => ({
          id: op.id,
          operation: op.operation,
          required: op.required
        })),
        {
          continueOnError: true,
          onProgress: (completed, total) => {
            console.log(`Partial loading progress: ${completed}/${total}`);
          },
          onPartialSuccess: (results) => {
            console.log('Partial loading results:', results);
          }
        }
      );

      // Process partial results
      const successfulData: any = {};
      partialResults.results.forEach(result => {
        if (result.data) {
          successfulData[result.id] = result.data;
        }
      });

      if (Object.keys(successfulData).length > 0) {
        setLoadedData(successfulData);
        onDataLoaded?.(successfulData);
      } else if (partialResults.hasRequiredFailures) {
        throw new Error('Required data could not be loaded');
      }

    } catch (error) {
      handleCriticalError(error);
    }
  }, [createLoadingOperations, onDataLoaded, handleCriticalError]);

  // Recovery actions
  const handleRecoveryAction = useCallback(async (action: string) => {
    switch (action) {
      case 'Retry Request':
        await handleRetryWithDegradation();
        break;
      
      case 'Reduce Data':
        // Retry with reduced data size
        const reducedOperations = createLoadingOperations().map(op => ({
          ...op,
          operation: async () => {
            if (op.id === 'asteroids') {
              return await apiClient.getClassificationAsteroids(
                selectedSystem!,
                selectedClassification!,
                Math.min(maxAsteroids, 20), // Reduce asteroid count
                0
              );
            }
            if (op.id === 'spectra') {
              return { spectra: [] }; // Skip spectral data
            }
            return await op.operation();
          }
        }));
        
        await startLoading(reducedOperations);
        break;
      
      case 'Check Connection':
        // Test connection and retry
        try {
          await apiClient.healthCheck();
          await handleRetryWithDegradation();
        } catch (error) {
          console.error('Connection test failed:', error);
        }
        break;
      
      case 'Refresh Page':
        window.location.reload();
        break;
      
      default:
        await handleRetryWithDegradation();
    }
  }, [
    handleRetryWithDegradation,
    createLoadingOperations,
    startLoading,
    selectedSystem,
    selectedClassification,
    maxAsteroids
  ]);

  const stats = getStats();

  // Show critical error recovery
  if (criticalError && !isLoading) {
    return (
      <div className={`enhanced-data-loader error ${className}`}>
        <ErrorRecovery
          error={criticalError}
          onRetry={handleRetryWithDegradation}
          onRecover={handleRecoveryAction}
          showDetailedSuggestions={true}
          allowRetry={true}
          retryLabel="Retry Loading"
        />
      </div>
    );
  }

  // Show progressive loading
  if (isLoading || steps.length > 0) {
    return (
      <div className={`enhanced-data-loader loading ${className}`}>
        <ProgressiveLoader
          steps={steps}
          onCancel={cancelLoading}
          onRetry={(stepId) => {
            const operations = createLoadingOperations();
            const operation = operations.find(op => op.id === stepId);
            if (operation) {
              retryStep(stepId, operation.operation);
            }
          }}
          showDetailedProgress={true}
          allowCancellation={true}
        />
        
        {stats.hasErrors && (
          <div className="retry-failed-section">
            <button 
              className="retry-failed-button"
              onClick={() => retryFailedSteps(createLoadingOperations())}
              disabled={isLoading}
            >
              Retry All Failed Steps
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show success state
  if (loadedData) {
    return (
      <div className={`enhanced-data-loader success ${className}`}>
        <div className="success-message">
          <h3>✅ Data Loaded Successfully</h3>
          <p>
            {loadedData.classifications && 'Classifications loaded. '}
            {loadedData.asteroids?.length > 0 && `${loadedData.asteroids.length} asteroids loaded. `}
            {loadedData.spectra?.length > 0 && `${loadedData.spectra.length} spectra loaded.`}
          </p>
          <button 
            className="reload-button"
            onClick={() => {
              setLoadedData(null);
              const operations = createLoadingOperations();
              startLoading(operations);
            }}
          >
            Reload Data
          </button>
        </div>
      </div>
    );
  }

  // Initial state
  return (
    <div className={`enhanced-data-loader idle ${className}`}>
      <div className="idle-message">
        <p>Ready to load data. Select a classification system to begin.</p>
      </div>
    </div>
  );
};

export default EnhancedDataLoader;