import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { Asteroid, SpectralData, ClassificationSystem } from '../context/AppContext';
import { validateApiRequest, formatValidationErrors } from '../utils/validation';

// API response types
export interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

export interface ClassificationResponse {
    systems: ClassificationSystem[];
}

export interface AsteroidsByClassResponse {
    classes: Array<{
        name: string;
        asteroids: Asteroid[];
    }>;
}

export interface BatchAsteroidsResponse {
    asteroids: Asteroid[];
}

export interface BatchSpectraResponse {
    spectra: SpectralData[];
}

// API error class
export class ApiError extends Error {
    public status: number;
    public data: any;
    public isRetryable: boolean;
    public timestamp: Date;

    constructor(message: string, status: number, data?: any, isRetryable: boolean = false) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.isRetryable = isRetryable;
        this.timestamp = new Date();
    }
}

// Validation error class
export class ValidationError extends Error {
    public field?: string;
    public code: string;

    constructor(message: string, field?: string, code: string = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
    }
}

// API client class
class ApiClient {
    private client: AxiosInstance;

    constructor() {
        // Try to determine the correct base URL
        const baseURL = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:5000/api'
            : '/api';
            
        this.client = axios.create({
            baseURL,
            timeout: 10000, // Reduced timeout for faster fallback
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                console.log(`API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error: AxiosError) => {
                console.error('API Response Error:', error);

                if (error.response) {
                    // Server responded with error status
                    const errorData = error.response.data;
                    let message = 'Server error occurred';
                    let isRetryable = false;

                    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
                        message = (errorData as { message: string }).message;
                    } else if (error.response.statusText) {
                        message = error.response.statusText;
                    }

                    // Determine if error is retryable
                    const status = error.response.status;
                    if (status >= 500 || status === 429 || status === 408) {
                        isRetryable = true;
                    }

                    // Provide user-friendly messages for common errors
                    if (status === 400) {
                        message = 'Invalid request. Please check your input and try again.';
                    } else if (status === 401) {
                        message = 'Authentication required. Please refresh the page.';
                    } else if (status === 403) {
                        message = 'Access denied. You do not have permission to perform this action.';
                    } else if (status === 404) {
                        message = 'The requested data was not found.';
                    } else if (status === 429) {
                        message = 'Too many requests. Please wait a moment and try again.';
                    } else if (status >= 500) {
                        message = 'Server error. Please try again later.';
                    }

                    throw new ApiError(message, error.response.status, error.response.data, isRetryable);
                } else if (error.request) {
                    // Request was made but no response received
                    throw new ApiError(
                        'Network error - please check your internet connection and try again', 
                        0, 
                        null, 
                        true
                    );
                } else {
                    // Something else happened
                    throw new ApiError(error.message || 'An unexpected error occurred', 0, null, false);
                }
            }
        );
    }

    // Classification endpoints
    async getClassifications(): Promise<ClassificationResponse> {
        const response = await this.client.get<ClassificationResponse>('/classifications');
        return response.data;
    }

    async getClassificationMetadata(system: 'bus_demeo' | 'tholen'): Promise<{
        system: string;
        classes: Array<{
            name: string;
            total_count: number;
            spectral_count: number;
            spectral_percentage: number;
        }>;
        total_asteroids: number;
        total_with_spectra: number;
        overall_spectral_percentage: number;
    }> {
        // Validate input
        const validation = validateApiRequest.classification(system);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'system');
        }

        const response = await this.client.get(`/classifications/${system}/metadata`);
        return response.data.metadata;
    }

    async getAsteroidsByClassification(
        system: 'bus_demeo' | 'tholen',
        limit?: number,
        offset?: number
    ): Promise<AsteroidsByClassResponse> {
        // Validate input
        const validation = validateApiRequest.classification(system, limit, offset);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'system');
        }

        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());

        const response = await this.client.get<AsteroidsByClassResponse>(
            `/classifications/${system}/asteroids?${params.toString()}`
        );
        return response.data;
    }

    async getClassificationAsteroids(
        system: 'bus_demeo' | 'tholen',
        classificationName: string,
        limit?: number,
        offset?: number
    ): Promise<{
        asteroids: Array<{
            id: number;
            official_number?: number;
            proper_name?: string;
            provisional_designation?: string;
            bus_demeo_class?: string;
            tholen_class?: string;
            display_name?: string;
            has_spectral_data?: boolean;
        }>;
        pagination: {
            page: number;
            pageSize: number;
            limit: number;
            offset: number;
            total: number;
            totalPages: number;
            hasMore: boolean;
            hasPrevious: boolean;
        };
        cacheKey: string;
    }> {
        // Validate input
        const validation = validateApiRequest.classification(system, limit, offset);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'system');
        }

        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());

        const response = await this.client.get(
            `/classifications/${system}/${encodeURIComponent(classificationName)}/asteroids?${params.toString()}`
        );

        const responseData = response.data ?? {};
        const rawAsteroids: any[] = Array.isArray(responseData.asteroids) ? responseData.asteroids : [];

        const toNumber = (value: unknown, fallback: number = 0): number => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : fallback;
        };

        const parseBoolean = (value: unknown): boolean | undefined => {
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'string') {
                const normalized = value.toLowerCase();
                if (normalized === 'true') {
                    return true;
                }
                if (normalized === 'false') {
                    return false;
                }
            }
            return undefined;
        };

        const processedAsteroids = rawAsteroids.map((asteroid: any) => {
            const identifiers = asteroid.identifiers ?? {};
            const classificationValue =
                asteroid.classification ??
                asteroid.classifications?.classification ??
                null;

            let busDeMeoClass =
                asteroid.classifications?.bus_demeo_class ??
                asteroid.bus_demeo_class ??
                null;
            let tholenClass =
                asteroid.classifications?.tholen_class ??
                asteroid.tholen_class ??
                null;

            if (system === 'bus_demeo' && !busDeMeoClass && classificationValue) {
                busDeMeoClass = classificationValue;
            }

            if (system === 'tholen' && !tholenClass && classificationValue) {
                tholenClass = classificationValue;
            }

            const displayName =
                asteroid.display_name ??
                identifiers.proper_name ??
                (identifiers.official_number
                    ? `(${identifiers.official_number})`
                    : identifiers.provisional_designation ?? `Asteroid ${asteroid.id}`);

            return {
                id: asteroid.id,
                official_number: identifiers.official_number,
                proper_name: identifiers.proper_name,
                provisional_designation: identifiers.provisional_designation,
                bus_demeo_class: busDeMeoClass ?? undefined,
                tholen_class: tholenClass ?? undefined,
                display_name: displayName,
                has_spectral_data: Boolean(asteroid.has_spectral_data)
            };
        });

        const paginationRaw = responseData.pagination ?? {};
        const requestedLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined;
        const inferredLimit = toNumber(
            paginationRaw.limit ?? paginationRaw.page_size ?? paginationRaw.pageSize ?? requestedLimit,
            requestedLimit ?? 0
        );
        const returnedCount = toNumber(
            paginationRaw.returned_count ?? paginationRaw.returnedCount,
            rawAsteroids.length
        );
        const offsetValue = toNumber(paginationRaw.offset ?? paginationRaw.start, 0);
        const pageSizeValue =
            inferredLimit > 0
                ? inferredLimit
                : requestedLimit && requestedLimit > 0
                    ? requestedLimit
                    : Math.max(returnedCount, 1);
        const totalValue = toNumber(
            paginationRaw.total ?? paginationRaw.total_count ?? paginationRaw.totalCount,
            offsetValue + returnedCount
        );

        const parsedHasMore =
            parseBoolean(paginationRaw.hasMore) ?? parseBoolean(paginationRaw.has_more);
        const hasMoreValue =
            parsedHasMore !== undefined ? parsedHasMore : offsetValue + returnedCount < totalValue;

        const currentPage = Math.floor(offsetValue / pageSizeValue) + 1;
        const totalPages = Math.max(1, Math.ceil(totalValue / pageSizeValue));

        const hasPrevious = currentPage > 1;

        return {
            asteroids: processedAsteroids,
            pagination: {
                page: currentPage,
                pageSize: pageSizeValue,
                limit: pageSizeValue,
                offset: offsetValue,
                total: totalValue,
                totalPages,
                hasMore: hasMoreValue,
                hasPrevious
            },
            cacheKey: `${system}-${classificationName}-${currentPage}-${pageSizeValue}`
        };
    }

    // New method for paginated loading with caching support
    async getClassificationAsteroidsPage(
        system: 'bus_demeo' | 'tholen',
        classificationName: string,
        page: number = 1,
        pageSize: number = 100
    ): Promise<{
        asteroids: Array<{
            id: number;
            official_number?: number;
            proper_name?: string;
            provisional_designation?: string;
            bus_demeo_class?: string;
            tholen_class?: string;
            display_name?: string;
            has_spectral_data?: boolean;
        }>;
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
            hasMore: boolean;
            hasPrevious: boolean;
        };
        cacheKey: string;
    }> {
        const offset = (page - 1) * pageSize;
        const result = await this.getClassificationAsteroids(system, classificationName, pageSize, offset);
        
        const cacheKey = `${system}-${classificationName}-${page}-${pageSize}`;
        
        return {
            asteroids: result.asteroids,
            pagination: {
                page,
                pageSize,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages,
                hasMore: result.pagination.hasMore,
                hasPrevious: page > 1
            },
            cacheKey
        };
    }

    // Asteroid data endpoints
    async getAsteroid(id: number): Promise<{ asteroid: any }> {
        // Validate input
        const validation = validateApiRequest.asteroidDetail(id);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'id');
        }

        const response = await this.client.get<{ asteroid: any }>(`/asteroids/${id}`);
        return response.data;
    }

    async getBatchAsteroids(asteroidIds: number[]): Promise<BatchAsteroidsResponse> {
        // Validate input
        const validation = validateApiRequest.asteroidBatch(asteroidIds);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'asteroidIds');
        }

        const response = await this.client.post<BatchAsteroidsResponse>('/asteroids/batch', {
            asteroid_ids: asteroidIds,
        });
        return response.data;
    }

    // Spectral data endpoints
    async getSpectrum(id: number): Promise<{ spectrum: any }> {
        // Validate input
        const validation = validateApiRequest.asteroidDetail(id);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'id');
        }

        const response = await this.client.get<{ spectrum: any }>(`/asteroids/${id}/spectrum`);
        return response.data;
    }

    async getAsteroidSpectrum(id: number): Promise<{ spectrum: any }> {
        return this.getSpectrum(id);
    }

    async getBatchSpectra(asteroidIds: number[]): Promise<BatchSpectraResponse> {
        // Validate input
        const validation = validateApiRequest.spectralData(asteroidIds);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'asteroidIds');
        }

        const response = await this.client.post<BatchSpectraResponse>('/spectra/batch', {
            asteroid_ids: asteroidIds,
        });
        return response.data;
    }

    async getAsteroidsSpectraBatch(asteroidIds: number[]): Promise<BatchSpectraResponse> {
        return this.getBatchSpectra(asteroidIds);
    }

    // Export endpoints
    async exportData(
        asteroidIds: number[],
        format: 'csv' | 'json',
        includeSpectral: boolean = false
    ): Promise<Blob> {
        // Validate input
        const validation = validateApiRequest.export(asteroidIds, format);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'asteroidIds');
        }

        const response = await this.client.post('/export/data', {
            asteroid_ids: asteroidIds,
            format,
            include_spectral: includeSpectral,
        }, {
            responseType: 'blob',
        });
        return response.data;
    }

    async exportSpectrum(
        asteroidIds: number[],
        includeRaw: boolean = false,
        format: 'csv' | 'json' = 'json'
    ): Promise<Blob> {
        // Validate input
        const validation = validateApiRequest.export(asteroidIds, format);
        if (!validation.isValid) {
            throw new ValidationError(formatValidationErrors(validation), 'asteroidIds');
        }

        const response = await this.client.post('/export/spectrum', {
            asteroid_ids: asteroidIds,
            include_raw: includeRaw,
            format,
        }, {
            responseType: 'blob',
        });
        return response.data;
    }

    // Health check endpoint
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await this.client.get('/health');
        return response.data;
    }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export utility functions for common API operations
export const apiUtils = {
    // Handle API errors with user-friendly messages
    getErrorMessage: (error: unknown): string => {
        if (error instanceof ValidationError) {
            return error.message;
        }
        if (error instanceof ApiError) {
            return error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return 'An unexpected error occurred';
    },

    // Get detailed error information for debugging
    getErrorDetails: (error: unknown): { 
        type: string; 
        message: string; 
        status?: number; 
        isRetryable?: boolean;
        timestamp?: Date;
        field?: string;
    } => {
        if (error instanceof ValidationError) {
            return {
                type: 'ValidationError',
                message: error.message,
                field: error.field,
            };
        }
        if (error instanceof ApiError) {
            return {
                type: 'ApiError',
                message: error.message,
                status: error.status,
                isRetryable: error.isRetryable,
                timestamp: error.timestamp,
            };
        }
        if (error instanceof Error) {
            return {
                type: error.name || 'Error',
                message: error.message,
            };
        }
        return {
            type: 'UnknownError',
            message: 'An unexpected error occurred',
        };
    },

    // Check if error is a validation error
    isValidationError: (error: unknown): boolean => {
        return error instanceof ValidationError;
    },

    // Check if error is a network error
    isNetworkError: (error: unknown): boolean => {
        return error instanceof ApiError && error.status === 0;
    },

    // Check if error is a server error (5xx)
    isServerError: (error: unknown): boolean => {
        return error instanceof ApiError && error.status >= 500;
    },

    // Check if error is a client error (4xx)
    isClientError: (error: unknown): boolean => {
        return error instanceof ApiError && error.status >= 400 && error.status < 500;
    },

    // Check if error is retryable
    isRetryableError: (error: unknown): boolean => {
        if (error instanceof ApiError) {
            return error.isRetryable;
        }
        return false;
    },

    // Get detailed error action suggestions with specific guidance
    getErrorActionSuggestion: (error: unknown): string => {
        if (apiUtils.isValidationError(error)) {
            const validationError = error as ValidationError;
            if (validationError.field) {
                return `Please check the ${validationError.field} field and ensure it meets the requirements.`;
            }
            return 'Please check your input and try again.';
        }
        
        if (apiUtils.isNetworkError(error)) {
            return 'Check your internet connection. If you\'re on a slow connection, try refreshing the page or waiting a moment.';
        }
        
        if (apiUtils.isServerError(error)) {
            const apiError = error as ApiError;
            if (apiError.status === 503) {
                return 'The service is temporarily unavailable. Please try again in a few minutes.';
            }
            if (apiError.status === 504) {
                return 'The request timed out. Try reducing the amount of data requested or try again later.';
            }
            return 'The server is experiencing issues. Please try again in a few moments or contact support if the problem persists.';
        }
        
        if (error instanceof ApiError) {
            switch (error.status) {
                case 400:
                    return 'The request format is invalid. Please refresh the page and try again.';
                case 401:
                    return 'Your session may have expired. Please refresh the page to continue.';
                case 403:
                    return 'You don\'t have permission to access this data. Contact your administrator if you believe this is an error.';
                case 404:
                    return 'The requested data was not found. It may have been moved or deleted. Try refreshing your selection.';
                case 409:
                    return 'There\'s a conflict with your request. Please refresh the page and try again.';
                case 413:
                    return 'The request is too large. Try selecting fewer items or reducing the data size.';
                case 422:
                    return 'The data format is invalid. Please check your selection and try again.';
                case 429:
                    return 'You\'re making requests too quickly. Please wait 30 seconds before trying again.';
                default:
                    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
            }
        }
        
        return 'An unexpected error occurred. Please try refreshing the page or contact support if the problem continues.';
    },

    // Get recovery suggestions for different error types
    getRecoverySuggestions: (error: unknown): Array<{
        action: string;
        description: string;
        priority: 'high' | 'medium' | 'low';
    }> => {
        const suggestions: Array<{
            action: string;
            description: string;
            priority: 'high' | 'medium' | 'low';
        }> = [];

        if (apiUtils.isNetworkError(error)) {
            suggestions.push(
                { action: 'Check Connection', description: 'Verify your internet connection', priority: 'high' },
                { action: 'Refresh Page', description: 'Reload the application', priority: 'medium' },
                { action: 'Try Later', description: 'Wait a few minutes and try again', priority: 'low' }
            );
        } else if (apiUtils.isServerError(error)) {
            suggestions.push(
                { action: 'Retry Request', description: 'Try the operation again', priority: 'high' },
                { action: 'Reduce Data', description: 'Select fewer items to reduce load', priority: 'medium' },
                { action: 'Contact Support', description: 'Report the issue if it persists', priority: 'low' }
            );
        } else if (error instanceof ApiError && error.status === 404) {
            suggestions.push(
                { action: 'Refresh Selection', description: 'Clear and reselect your data', priority: 'high' },
                { action: 'Browse Available Data', description: 'Explore what data is currently available', priority: 'medium' }
            );
        } else if (error instanceof ApiError && error.status === 429) {
            suggestions.push(
                { action: 'Wait and Retry', description: 'Wait 30 seconds before trying again', priority: 'high' },
                { action: 'Reduce Requests', description: 'Make fewer simultaneous requests', priority: 'medium' }
            );
        } else {
            suggestions.push(
                { action: 'Retry Operation', description: 'Try the operation again', priority: 'high' },
                { action: 'Refresh Page', description: 'Reload the application', priority: 'medium' },
                { action: 'Contact Support', description: 'Get help if the problem continues', priority: 'low' }
            );
        }

        return suggestions;
    },

    // Graceful degradation helper
    async withGracefulDegradation<T>(
        operation: () => Promise<T>,
        fallback: T | (() => T | Promise<T>),
        options: {
            logError?: boolean;
            onFallback?: (error: unknown) => void;
        } = {}
    ): Promise<T> {
        const { logError = true, onFallback } = options;
        
        try {
            return await operation();
        } catch (error) {
            if (logError) {
                console.warn('Operation failed, using fallback:', error);
            }
            
            onFallback?.(error);
            
            return typeof fallback === 'function' 
                ? await (fallback as () => T | Promise<T>)()
                : fallback;
        }
    },

    // Partial data loading with error tolerance
    async loadPartialData<T>(
        operations: Array<{
            id: string;
            operation: () => Promise<T>;
            required?: boolean;
        }>,
        options: {
            onPartialSuccess?: (results: Array<{ id: string; data: T | null; error: unknown | null }>) => void;
            onProgress?: (completed: number, total: number) => void;
            continueOnError?: boolean;
        } = {}
    ): Promise<{
        results: Array<{ id: string; data: T | null; error: unknown | null }>;
        successCount: number;
        errorCount: number;
        hasRequiredFailures: boolean;
    }> {
        const { onPartialSuccess, onProgress, continueOnError = true } = options;
        const results: Array<{ id: string; data: T | null; error: unknown | null }> = [];
        let successCount = 0;
        let errorCount = 0;
        let hasRequiredFailures = false;

        for (let i = 0; i < operations.length; i++) {
            const { id, operation, required = false } = operations[i];
            
            try {
                const data = await operation();
                results.push({ id, data, error: null });
                successCount++;
            } catch (error) {
                results.push({ id, data: null, error });
                errorCount++;
                
                if (required) {
                    hasRequiredFailures = true;
                    if (!continueOnError) {
                        break;
                    }
                }
                
                console.warn(`Partial data loading failed for ${id}:`, error);
            }
            
            onProgress?.(i + 1, operations.length);
        }

        onPartialSuccess?.(results);
        
        return {
            results,
            successCount,
            errorCount,
            hasRequiredFailures
        };
    },

    // Enhanced retry logic with progress tracking and cancellation
    async withRetry<T>(
        operation: () => Promise<T>,
        options: {
            maxRetries?: number;
            baseDelay?: number;
            maxDelay?: number;
            onRetry?: (attempt: number, delay: number, error: unknown) => void;
            onProgress?: (progress: { attempt: number; maxRetries: number; delay: number }) => void;
            signal?: AbortSignal;
        } = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            onRetry,
            onProgress,
            signal
        } = options;

        let lastError: unknown;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Check for cancellation
            if (signal?.aborted) {
                throw new Error('Operation cancelled by user');
            }

            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry validation errors or non-retryable errors
                if (apiUtils.isValidationError(error) || !apiUtils.isRetryableError(error)) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Calculate delay with exponential backoff and jitter
                const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 1000;
                const delay = Math.min(exponentialDelay + jitter, maxDelay);
                
                // Notify about retry attempt
                onRetry?.(attempt, delay, error);
                onProgress?.({ attempt, maxRetries, delay });
                
                console.log(`Retrying operation in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                
                // Wait with cancellation support
                await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(resolve, delay);
                    
                    if (signal) {
                        const abortHandler = () => {
                            clearTimeout(timeoutId);
                            reject(new Error('Operation cancelled by user'));
                        };
                        signal.addEventListener('abort', abortHandler, { once: true });
                    }
                });
            }
        }

        throw lastError;
    },

    // Circuit breaker pattern for preventing cascading failures
    createCircuitBreaker: <T extends any[], R>(
        operation: (...args: T) => Promise<R>,
        failureThreshold: number = 5,
        resetTimeout: number = 60000
    ) => {
        let failureCount = 0;
        let lastFailureTime = 0;
        let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

        return async (...args: T): Promise<R> => {
            const now = Date.now();

            // Reset circuit breaker if enough time has passed
            if (state === 'OPEN' && now - lastFailureTime > resetTimeout) {
                state = 'HALF_OPEN';
                failureCount = 0;
            }

            // Reject immediately if circuit is open
            if (state === 'OPEN') {
                throw new ApiError(
                    'Service temporarily unavailable. Please try again later.',
                    503,
                    null,
                    true
                );
            }

            try {
                const result = await operation(...args);
                
                // Reset on success
                if (state === 'HALF_OPEN') {
                    state = 'CLOSED';
                }
                failureCount = 0;
                
                return result;
            } catch (error) {
                failureCount++;
                lastFailureTime = now;

                // Open circuit if failure threshold is reached
                if (failureCount >= failureThreshold) {
                    state = 'OPEN';
                }

                throw error;
            }
        };
    },

    // Debounce API calls to prevent excessive requests
    debounce: <T extends any[], R>(
        func: (...args: T) => Promise<R>,
        delay: number = 300
    ) => {
        let timeoutId: NodeJS.Timeout;
        let lastPromise: Promise<R> | null = null;

        return (...args: T): Promise<R> => {
            return new Promise((resolve, reject) => {
                clearTimeout(timeoutId);
                
                timeoutId = setTimeout(async () => {
                    try {
                        const result = await func(...args);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, delay);
            });
        };
    },
};
