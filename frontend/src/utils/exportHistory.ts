/**
 * Export History Storage Utility
 * 
 * Manages export history tracking in localStorage.
 * Stores the last 10 export operations with metadata.
 */

export interface ExportHistoryEntry {
    id: string;
    timestamp: string;
    itemCount: number;
    format: 'csv' | 'json' | 'hdf5' | 'fits';
    dataType: 'asteroids' | 'meteorites';
    fileSizeBytes: number;
    fileSizeHuman: string;
    itemIds: string[];
    includeFields: {
        basicInfo: boolean;
        classification: boolean;
        orbitalParams: boolean;
        physicalProps: boolean;
        spectralData: boolean;
    };
    spectralOptions?: {
        wavelengthRange?: [number, number];
        resolution: 'original' | 'resampled';
        includeUncertainty: boolean;
        includeMetadata: boolean;
    };
}

const STORAGE_KEY = 'asteroid_spectral_export_history';
const MAX_HISTORY_ENTRIES = 10;

/**
 * Add an export operation to history
 * @param entry - The export history entry to add
 */
export function addExportToHistory(entry: Omit<ExportHistoryEntry, 'id'>): void {
    try {
        const history = getExportHistory();
        
        // Create new entry with unique ID
        const newEntry: ExportHistoryEntry = {
            ...entry,
            id: generateEntryId(),
        };
        
        // Add to beginning of array
        history.unshift(newEntry);
        
        // Keep only last 10 entries
        const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES);
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.error('Failed to add export to history:', error);
        // Silently fail - history is a convenience feature
    }
}

/**
 * Get export history from localStorage
 * @returns Array of export history entries (most recent first)
 */
export function getExportHistory(): ExportHistoryEntry[] {
    try {
        const serialized = localStorage.getItem(STORAGE_KEY);
        
        if (!serialized) {
            return [];
        }
        
        const history = JSON.parse(serialized) as ExportHistoryEntry[];
        
        // Validate array
        if (!Array.isArray(history)) {
            console.warn('Invalid history structure, returning empty array');
            return [];
        }
        
        // Filter out invalid entries
        return history.filter(isValidHistoryEntry);
    } catch (error) {
        console.error('Failed to load export history:', error);
        return [];
    }
}

/**
 * Clear all export history
 */
export function clearExportHistory(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear export history:', error);
    }
}

/**
 * Remove a specific entry from history
 * @param entryId - The ID of the entry to remove
 */
export function removeExportFromHistory(entryId: string): void {
    try {
        const history = getExportHistory();
        const filtered = history.filter(entry => entry.id !== entryId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to remove export from history:', error);
    }
}

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Human-readable file size string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns Formatted date/time string
 */
export function formatTimestamp(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        
        // Check if date is invalid
        if (isNaN(date.getTime())) {
            return timestamp;
        }
        
        // Check if date is today
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        
        if (isToday) {
            // Show "Today at HH:MM"
            return `Today at ${date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }
        
        // Check if date is yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();
        
        if (isYesterday) {
            return `Yesterday at ${date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }
        
        // Show full date
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return timestamp;
    }
}

/**
 * Generate a unique ID for a history entry
 * @returns Unique ID string
 */
function generateEntryId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate a history entry structure
 * @param entry - The entry to validate
 * @returns True if valid, false otherwise
 */
function isValidHistoryEntry(entry: any): entry is ExportHistoryEntry {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    
    // Check required fields
    if (!entry.id || typeof entry.id !== 'string') return false;
    if (!entry.timestamp || typeof entry.timestamp !== 'string') return false;
    if (typeof entry.itemCount !== 'number') return false;
    if (!['csv', 'json', 'hdf5', 'fits'].includes(entry.format)) return false;
    if (!['asteroids', 'meteorites'].includes(entry.dataType)) return false;
    if (typeof entry.fileSizeBytes !== 'number') return false;
    if (!entry.fileSizeHuman || typeof entry.fileSizeHuman !== 'string') return false;
    if (!Array.isArray(entry.itemIds)) return false;
    
    // Check includeFields
    if (!entry.includeFields || typeof entry.includeFields !== 'object') {
        return false;
    }
    
    const requiredFields = ['basicInfo', 'classification', 'orbitalParams', 'physicalProps', 'spectralData'];
    for (const field of requiredFields) {
        if (typeof entry.includeFields[field] !== 'boolean') {
            return false;
        }
    }
    
    // Check spectralOptions if present
    if (entry.spectralOptions !== undefined) {
        if (typeof entry.spectralOptions !== 'object') return false;
        if (!['original', 'resampled'].includes(entry.spectralOptions.resolution)) return false;
        if (typeof entry.spectralOptions.includeUncertainty !== 'boolean') return false;
        if (typeof entry.spectralOptions.includeMetadata !== 'boolean') return false;
    }
    
    return true;
}
