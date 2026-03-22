/**
 * API Configuration
 * Centralized API URL management for different environments
 */

// Get API base URL from environment variable or use relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get full API URL for a given path
 * @param path - API path (e.g., '/api/meteorites' or 'api/meteorites')
 * @returns Full API URL
 */
export const getApiUrl = (path: string): string => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If API_BASE_URL is set, use it (for ngrok or production)
  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }
  
  // Otherwise use relative path (will go through Vite proxy in development)
  return normalizedPath;
};

/**
 * Fetch wrapper with automatic API URL resolution
 * @param path - API path
 * @param options - Fetch options
 * @returns Fetch promise
 */
export const apiFetch = (path: string, options?: RequestInit): Promise<Response> => {
  return fetch(getApiUrl(path), options);
};

// Export API base URL for reference
export { API_BASE_URL };
