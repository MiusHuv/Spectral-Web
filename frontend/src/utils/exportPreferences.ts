/**
 * Export Preferences Storage Utility
 * 
 * Manages saving and loading user's export preferences to/from localStorage.
 * This allows users to maintain their preferred export settings across sessions.
 */

export interface ExportPreferences {
    format: 'csv' | 'json' | 'hdf5' | 'fits';
    includeFields: {
        basicInfo: boolean;
        classification: boolean;
        orbitalParams: boolean;
        physicalProps: boolean;
        spectralData: boolean;
    };
    spectralOptions: {
        wavelengthRange?: [number, number];
        resolution: 'original' | 'resampled';
        includeUncertainty: boolean;
        includeMetadata: boolean;
    };
}

const STORAGE_KEY = 'asteroid_spectral_export_preferences';

/**
 * Save export preferences to localStorage
 * @param preferences - The export preferences to save
 */
export function saveExportPreferences(preferences: ExportPreferences): void {
    try {
        const serialized = JSON.stringify(preferences);
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
        console.error('Failed to save export preferences:', error);
        // Silently fail - preferences are a convenience feature
    }
}

/**
 * Load export preferences from localStorage
 * @returns The saved preferences, or default preferences if none exist
 */
export function loadExportPreferences(): ExportPreferences | null {
    try {
        const serialized = localStorage.getItem(STORAGE_KEY);
        
        if (!serialized) {
            return null;
        }
        
        const preferences = JSON.parse(serialized) as ExportPreferences;
        
        // Validate the loaded preferences have the expected structure
        if (!isValidPreferences(preferences)) {
            console.warn('Invalid preferences structure, returning null');
            return null;
        }
        
        return preferences;
    } catch (error) {
        console.error('Failed to load export preferences:', error);
        return null;
    }
}

/**
 * Clear saved export preferences
 */
export function clearExportPreferences(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear export preferences:', error);
    }
}

/**
 * Get default export preferences
 * @returns Default preferences object
 */
export function getDefaultPreferences(): ExportPreferences {
    return {
        format: 'csv',
        includeFields: {
            basicInfo: true,
            classification: true,
            orbitalParams: true,
            physicalProps: true,
            spectralData: true,
        },
        spectralOptions: {
            resolution: 'original',
            includeUncertainty: true,
            includeMetadata: true,
        },
    };
}

/**
 * Validate preferences structure
 * @param preferences - The preferences object to validate
 * @returns True if valid, false otherwise
 */
function isValidPreferences(preferences: any): preferences is ExportPreferences {
    if (!preferences || typeof preferences !== 'object') {
        return false;
    }
    
    // Check format
    if (!['csv', 'json', 'hdf5', 'fits'].includes(preferences.format)) {
        return false;
    }
    
    // Check includeFields
    if (!preferences.includeFields || typeof preferences.includeFields !== 'object') {
        return false;
    }
    
    const requiredFields = ['basicInfo', 'classification', 'orbitalParams', 'physicalProps', 'spectralData'];
    for (const field of requiredFields) {
        if (typeof preferences.includeFields[field] !== 'boolean') {
            return false;
        }
    }
    
    // Check spectralOptions
    if (!preferences.spectralOptions || typeof preferences.spectralOptions !== 'object') {
        return false;
    }
    
    if (!['original', 'resampled'].includes(preferences.spectralOptions.resolution)) {
        return false;
    }
    
    if (typeof preferences.spectralOptions.includeUncertainty !== 'boolean' ||
        typeof preferences.spectralOptions.includeMetadata !== 'boolean') {
        return false;
    }
    
    // Validate wavelengthRange if present
    if (preferences.spectralOptions.wavelengthRange !== undefined) {
        if (!Array.isArray(preferences.spectralOptions.wavelengthRange) ||
            preferences.spectralOptions.wavelengthRange.length !== 2 ||
            typeof preferences.spectralOptions.wavelengthRange[0] !== 'number' ||
            typeof preferences.spectralOptions.wavelengthRange[1] !== 'number') {
            return false;
        }
    }
    
    return true;
}
