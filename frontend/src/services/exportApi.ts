import axios, { AxiosInstance, AxiosError } from 'axios';

// Export configuration types
export interface SpectralOptions {
    wavelengthRange?: [number, number];
    resolution?: 'original' | 'resampled';
    includeUncertainty: boolean;
    includeMetadata: boolean;
}

export interface IncludeFields {
    basicInfo: boolean;
    classification: boolean;
    orbitalParams: boolean;
    physicalProps: boolean;
    spectralData: boolean;
}

export interface ExportConfiguration {
    itemIds: string[];
    format: 'csv' | 'json' | 'hdf5' | 'fits';
    includeFields: IncludeFields;
    spectralOptions?: SpectralOptions;
}

// Export response types
export interface ExportPreview {
    preview: {
        format: string;
        sampleData: string;
        structure: {
            columns: string[];
            rowCount: number;
        };
    };
    estimatedSizeBytes: number;
    estimatedSizeHuman: string;
}

export interface SizeEstimate {
    estimatedSizeBytes: number;
    estimatedSizeHuman: string;
    itemCount: number;
    includesSpectralData: boolean;
}

// Error types
export class ExportError extends Error {
    public status: number;
    public code: string;
    public details?: any;
    public isRetryable: boolean;

    constructor(message: string, status: number, code: string = 'EXPORT_ERROR', details?: any, isRetryable: boolean = false) {
        super(message);
        this.name = 'ExportError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.isRetryable = isRetryable;
    }
}

// Export API client class
class ExportApiClient {
    private client: AxiosInstance;

    constructor() {
        // Use environment variable if available, otherwise fallback to defaults
        const apiUrl = import.meta.env.VITE_API_URL || (
            process.env.NODE_ENV === 'development' 
                ? 'http://localhost:5000'
                : ''
        );
        const baseURL = apiUrl ? `${apiUrl}/api` : '/api';
            
        this.client = axios.create({
            baseURL,
            timeout: 180000, // 3 minutes for large exports
            headers: {
                'Content-Type': 'application/json',
            },
            // Ensure credentials are included for CORS
            withCredentials: false,
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                console.log(`Export API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('Export API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                console.log(`Export API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error: AxiosError) => {
                return Promise.reject(this.handleError(error));
            }
        );
    }

    /**
     * Handle API errors and convert to ExportError
     */
    private handleError(error: AxiosError): ExportError {
        console.error('Export API Error:', error);

        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data as any;
            
            let message = 'Export failed';
            let code = 'EXPORT_ERROR';
            let isRetryable = false;

            // Extract error message from response
            if (errorData?.error?.message) {
                message = errorData.error.message;
                code = errorData.error.code || code;
            } else if (errorData?.message) {
                message = errorData.message;
            } else if (error.response.statusText) {
                message = error.response.statusText;
            }

            // Determine if error is retryable
            if (status >= 500 || status === 429 || status === 408) {
                isRetryable = true;
            }

            // Provide user-friendly messages for common errors
            if (status === 400) {
                message = errorData?.error?.message || 'Invalid export configuration. Please check your selections.';
                code = 'VALIDATION_ERROR';
            } else if (status === 413) {
                message = 'Export size exceeds limit. Please select fewer items or reduce data fields.';
                code = 'SIZE_LIMIT_EXCEEDED';
            } else if (status === 429) {
                message = 'Too many export requests. Please wait a moment and try again.';
                code = 'RATE_LIMIT_EXCEEDED';
                isRetryable = true;
            } else if (status >= 500) {
                message = 'Server error during export. Please try again later.';
                code = 'SERVER_ERROR';
                isRetryable = true;
            }

            return new ExportError(
                message,
                status,
                code,
                errorData?.error?.details,
                isRetryable
            );
        } else if (error.request) {
            // Request was made but no response received
            let message = 'Network error - please check your internet connection';
            let code = 'NETWORK_ERROR';
            
            // Check if it's a timeout
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                message = 'Request timeout - the export is taking too long. Try selecting fewer items or reducing data fields.';
                code = 'TIMEOUT_ERROR';
            }
            
            return new ExportError(
                message,
                0,
                code,
                { 
                    errorCode: error.code,
                    errorMessage: error.message,
                    request: {
                        url: error.config?.url,
                        method: error.config?.method,
                        baseURL: error.config?.baseURL
                    }
                },
                true
            );
        } else {
            return new ExportError(
                error.message || 'An unexpected error occurred',
                0,
                'UNKNOWN_ERROR',
                { originalError: error },
                false
            );
        }
    }

    /**
     * Convert export configuration to API request format
     */
    private configToRequestBody(config: ExportConfiguration, dataType: 'asteroids' | 'meteorites') {
        return {
            item_ids: config.itemIds,
            format: config.format,
            include_fields: {
                basic_info: config.includeFields.basicInfo,
                classification: config.includeFields.classification,
                orbital_params: config.includeFields.orbitalParams,
                physical_props: config.includeFields.physicalProps,
                spectral_data: config.includeFields.spectralData,
            },
            spectral_options: config.spectralOptions ? {
                wavelength_range: config.spectralOptions.wavelengthRange,
                resolution: config.spectralOptions.resolution,
                include_uncertainty: config.spectralOptions.includeUncertainty,
                include_metadata: config.spectralOptions.includeMetadata,
            } : undefined,
        };
    }

    /**
     * Export asteroid data
     */
    async exportAsteroids(config: ExportConfiguration): Promise<{ blob: Blob; filename?: string }> {
        const requestBody = this.configToRequestBody(config, 'asteroids');
        
        const response = await this.client.post('/export/asteroids', requestBody, {
            responseType: 'blob',
        });

        // Extract filename from Content-Disposition header
        const filename = this.extractFilenameFromResponse(response);

        return { blob: response.data, filename };
    }

    /**
     * Export meteorite data
     */
    async exportMeteorites(config: ExportConfiguration): Promise<{ blob: Blob; filename?: string }> {
        const requestBody = this.configToRequestBody(config, 'meteorites');
        
        const response = await this.client.post('/export/meteorites', requestBody, {
            responseType: 'blob',
        });

        // Extract filename from Content-Disposition header
        const filename = this.extractFilenameFromResponse(response);

        return { blob: response.data, filename };
    }

    /**
     * Extract filename from Content-Disposition header
     */
    private extractFilenameFromResponse(response: any): string | undefined {
        console.log('Response headers:', response.headers);
        const contentDisposition = response.headers['content-disposition'];
        console.log('Content-Disposition:', contentDisposition);
        
        if (contentDisposition) {
            // Try to extract filename from Content-Disposition header
            // Format: attachment; filename="filename.ext"
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            console.log('Filename match:', filenameMatch);
            
            if (filenameMatch && filenameMatch[1]) {
                const filename = filenameMatch[1].replace(/['"]/g, '');
                console.log('Extracted filename:', filename);
                return filename;
            }
        }
        console.log('No filename extracted, returning undefined');
        return undefined;
    }

    /**
     * Preview export data structure
     */
    async previewExport(
        config: ExportConfiguration,
        dataType: 'asteroids' | 'meteorites'
    ): Promise<ExportPreview> {
        const requestBody = this.configToRequestBody(config, dataType);
        
        const response = await this.client.post('/export/preview', {
            ...requestBody,
            data_type: dataType,
        });

        return {
            preview: {
                format: response.data.preview.format,
                sampleData: response.data.preview.sample_data,
                structure: {
                    columns: response.data.preview.structure.columns,
                    rowCount: response.data.preview.structure.row_count,
                },
            },
            estimatedSizeBytes: response.data.estimated_size_bytes,
            estimatedSizeHuman: response.data.estimated_size_human,
        };
    }

    /**
     * Estimate export file size
     */
    async estimateExportSize(
        config: ExportConfiguration,
        dataType: 'asteroids' | 'meteorites'
    ): Promise<SizeEstimate> {
        const requestBody = this.configToRequestBody(config, dataType);
        
        const response = await this.client.post('/export/estimate-size', {
            ...requestBody,
            data_type: dataType,
        });

        return {
            estimatedSizeBytes: response.data.estimated_size_bytes,
            estimatedSizeHuman: response.data.estimated_size_human,
            itemCount: response.data.item_count,
            includesSpectralData: response.data.includes_spectral_data,
        };
    }
}

// Create and export singleton instance
export const exportApiClient = new ExportApiClient();

/**
 * Trigger file download in browser
 */
export function triggerDownload(blob: Blob, filename: string): void {
    // Create blob URL
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL after a short delay
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
    dataType: 'asteroids' | 'meteorites',
    format: string,
    itemCount: number,
    isCart: boolean = false
): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    if (isCart) {
        return `cart_export_${itemCount}items_${timestamp}.${format === 'hdf5' ? 'h5' : format}`;
    } else if (itemCount === 1) {
        return `${dataType}_single_${timestamp}.${format === 'hdf5' ? 'h5' : format}`;
    } else {
        return `${dataType}_batch_${itemCount}items_${timestamp}.${format === 'hdf5' ? 'h5' : format}`;
    }
}

// Export utility functions
export const exportUtils = {
    /**
     * Get user-friendly error message
     */
    getErrorMessage: (error: unknown): string => {
        if (error instanceof ExportError) {
            return error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return 'An unexpected error occurred during export';
    },

    /**
     * Get detailed error information
     */
    getErrorDetails: (error: unknown): {
        type: string;
        message: string;
        status?: number;
        code?: string;
        isRetryable?: boolean;
        details?: any;
    } => {
        if (error instanceof ExportError) {
            return {
                type: 'ExportError',
                message: error.message,
                status: error.status,
                code: error.code,
                isRetryable: error.isRetryable,
                details: error.details,
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

    /**
     * Check if error is retryable
     */
    isRetryableError: (error: unknown): boolean => {
        return error instanceof ExportError && error.isRetryable;
    },

    /**
     * Get error action suggestion
     */
    getErrorActionSuggestion: (error: unknown): string => {
        if (!(error instanceof ExportError)) {
            return 'Please try again or contact support if the problem persists.';
        }

        switch (error.code) {
            case 'VALIDATION_ERROR':
                return 'Please check your export configuration and ensure all required fields are valid.';
            
            case 'SIZE_LIMIT_EXCEEDED':
                return 'Try selecting fewer items, reducing the number of fields, or excluding spectral data to reduce the export size.';
            
            case 'RATE_LIMIT_EXCEEDED':
                return 'Please wait 60 seconds before attempting another export.';
            
            case 'TIMEOUT_ERROR':
                return 'The export request timed out. Try selecting fewer items, reducing fields, or excluding spectral data to speed up the export.';
            
            case 'NETWORK_ERROR':
                return 'Check your internet connection and try again. For large exports, ensure you have a stable connection.';
            
            case 'SERVER_ERROR':
                return 'The server is experiencing issues. Please try again in a few moments.';
            
            default:
                return 'Please try again or contact support if the problem persists.';
        }
    },

    /**
     * Get recovery suggestions
     */
    getRecoverySuggestions: (error: unknown): Array<{
        action: string;
        description: string;
        priority: 'high' | 'medium' | 'low';
    }> => {
        if (!(error instanceof ExportError)) {
            return [
                { action: 'Retry Export', description: 'Try the export again', priority: 'high' },
                { action: 'Contact Support', description: 'Get help if the problem continues', priority: 'low' },
            ];
        }

        const suggestions: Array<{
            action: string;
            description: string;
            priority: 'high' | 'medium' | 'low';
        }> = [];

        switch (error.code) {
            case 'SIZE_LIMIT_EXCEEDED':
                suggestions.push(
                    { action: 'Reduce Items', description: 'Select fewer items to export', priority: 'high' },
                    { action: 'Exclude Spectral Data', description: 'Export metadata only', priority: 'medium' },
                    { action: 'Split into Batches', description: 'Export in multiple smaller batches', priority: 'medium' }
                );
                break;
            
            case 'RATE_LIMIT_EXCEEDED':
                suggestions.push(
                    { action: 'Wait and Retry', description: 'Wait 60 seconds before trying again', priority: 'high' },
                    { action: 'Reduce Frequency', description: 'Make fewer export requests', priority: 'medium' }
                );
                break;
            
            case 'TIMEOUT_ERROR':
                suggestions.push(
                    { action: 'Reduce Items', description: 'Select fewer items to export', priority: 'high' },
                    { action: 'Exclude Spectral Data', description: 'Export metadata only to reduce size', priority: 'high' },
                    { action: 'Split into Batches', description: 'Export in multiple smaller batches', priority: 'medium' },
                    { action: 'Retry Export', description: 'Try the export again', priority: 'low' }
                );
                break;
            
            case 'NETWORK_ERROR':
                suggestions.push(
                    { action: 'Check Connection', description: 'Verify your internet connection', priority: 'high' },
                    { action: 'Check Backend', description: 'Ensure the backend server is running', priority: 'high' },
                    { action: 'Retry Export', description: 'Try the export again', priority: 'medium' },
                    { action: 'Reduce Export Size', description: 'Select fewer items for better reliability', priority: 'low' }
                );
                break;
            
            case 'SERVER_ERROR':
                suggestions.push(
                    { action: 'Retry Export', description: 'Try the export again', priority: 'high' },
                    { action: 'Try Later', description: 'Wait a few minutes and try again', priority: 'medium' },
                    { action: 'Contact Support', description: 'Report the issue if it persists', priority: 'low' }
                );
                break;
            
            default:
                suggestions.push(
                    { action: 'Retry Export', description: 'Try the export again', priority: 'high' },
                    { action: 'Check Configuration', description: 'Verify your export settings', priority: 'medium' },
                    { action: 'Contact Support', description: 'Get help if the problem continues', priority: 'low' }
                );
        }

        return suggestions;
    },

    /**
     * Format file size for display
     */
    formatFileSize: (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Validate export configuration
     */
    validateConfiguration: (config: ExportConfiguration): { isValid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (!config.itemIds || config.itemIds.length === 0) {
            errors.push('No items selected for export');
        }

        if (config.itemIds && config.itemIds.length > 1000) {
            errors.push('Maximum 1000 items allowed per export');
        }

        if (!['csv', 'json', 'hdf5', 'fits'].includes(config.format)) {
            errors.push('Invalid export format');
        }

        if (!config.includeFields) {
            errors.push('Include fields configuration is required');
        }

        if (config.includeFields?.spectralData && !config.spectralOptions) {
            errors.push('Spectral options are required when spectral data is included');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    },
};
