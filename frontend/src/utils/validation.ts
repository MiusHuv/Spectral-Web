/**
 * Validation utilities for user inputs and API requests
 */

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Asteroid ID validation
export const validateAsteroidId = (id: any): ValidationResult => {
  const errors: string[] = [];
  
  if (id === null || id === undefined) {
    errors.push('Asteroid ID is required');
    return { isValid: false, errors };
  }
  
  const numId = Number(id);
  
  if (isNaN(numId)) {
    errors.push('Asteroid ID must be a valid number');
  } else if (!Number.isInteger(numId)) {
    errors.push('Asteroid ID must be an integer');
  } else if (numId <= 0) {
    errors.push('Asteroid ID must be positive');
  } else if (numId > 999999999) {
    errors.push('Asteroid ID is too large');
  }
  
  return { isValid: errors.length === 0, errors };
};

// Asteroid ID array validation
export const validateAsteroidIds = (ids: any[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!Array.isArray(ids)) {
    errors.push('Asteroid IDs must be provided as an array');
    return { isValid: false, errors };
  }
  
  if (ids.length === 0) {
    errors.push('At least one asteroid ID must be provided');
    return { isValid: false, errors };
  }
  
  if (ids.length > 100) {
    errors.push('Maximum 100 asteroid IDs can be processed at once');
  }
  
  if (ids.length > 50) {
    warnings.push('Large number of asteroids may take longer to process');
  }
  
  // Validate each ID
  const invalidIds: any[] = [];
  const duplicateIds: number[] = [];
  const seenIds = new Set<number>();
  
  ids.forEach((id, index) => {
    const validation = validateAsteroidId(id);
    if (!validation.isValid) {
      invalidIds.push({ index, id, errors: validation.errors });
    } else {
      const numId = Number(id);
      if (seenIds.has(numId)) {
        duplicateIds.push(numId);
      } else {
        seenIds.add(numId);
      }
    }
  });
  
  if (invalidIds.length > 0) {
    errors.push(`Invalid asteroid IDs found: ${invalidIds.map(item => 
      `${item.id} (${item.errors.join(', ')})`
    ).join('; ')}`);
  }
  
  if (duplicateIds.length > 0) {
    warnings.push(`Duplicate asteroid IDs found: ${duplicateIds.join(', ')}`);
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
};

// Search query validation
export const validateSearchQuery = (query: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!query || typeof query !== 'string') {
    errors.push('Search query is required');
    return { isValid: false, errors };
  }
  
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length === 0) {
    errors.push('Search query cannot be empty');
  } else if (trimmedQuery.length < 2) {
    errors.push('Search query must be at least 2 characters long');
  } else if (trimmedQuery.length > 100) {
    errors.push('Search query is too long (maximum 100 characters)');
  }
  
  // Check for potentially problematic characters
  const problematicChars = /[<>'"&]/;
  if (problematicChars.test(trimmedQuery)) {
    warnings.push('Search query contains special characters that may affect results');
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
};

// Pagination parameters validation
export const validatePaginationParams = (limit?: number, offset?: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) {
      errors.push('Limit must be a positive integer');
    } else if (limit > 1000) {
      errors.push('Limit cannot exceed 1000');
    } else if (limit > 100) {
      warnings.push('Large limit values may impact performance');
    }
  }
  
  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
};

// Export format validation
export const validateExportFormat = (format: string): ValidationResult => {
  const errors: string[] = [];
  const validFormats = ['csv', 'json', 'png', 'svg'];
  
  if (!format || typeof format !== 'string') {
    errors.push('Export format is required');
    return { isValid: false, errors };
  }
  
  if (!validFormats.includes(format.toLowerCase())) {
    errors.push(`Invalid export format. Supported formats: ${validFormats.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

// Classification system validation
export const validateClassificationSystem = (system: string): ValidationResult => {
  const errors: string[] = [];
  const validSystems = ['bus_demeo', 'tholen'];
  
  if (!system || typeof system !== 'string') {
    errors.push('Classification system is required');
    return { isValid: false, errors };
  }
  
  if (!validSystems.includes(system.toLowerCase())) {
    errors.push(`Invalid classification system. Supported systems: ${validSystems.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

// Generic object validation
export const validateRequiredFields = (obj: any, requiredFields: string[]): ValidationResult => {
  const errors: string[] = [];
  
  if (!obj || typeof obj !== 'object') {
    errors.push('Invalid object provided');
    return { isValid: false, errors };
  }
  
  requiredFields.forEach(field => {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
      errors.push(`Required field '${field}' is missing`);
    }
  });
  
  return { isValid: errors.length === 0, errors };
};

// Sanitization utilities
export const sanitizeInput = {
  // Sanitize string input to prevent XSS
  string: (input: string): string => {
    if (typeof input !== 'string') {
      return String(input).trim();
    }
    return input
      .trim()
      .replace(/[<>'"&]/g, ''); // Remove dangerous characters completely
  },
  
  // Sanitize numeric input
  number: (input: any): number | null => {
    if (input === null || input === undefined) return null;
    const num = Number(input);
    return isNaN(num) ? null : num;
  },
  
  // Sanitize array of numbers
  numberArray: (input: any[]): number[] => {
    if (!Array.isArray(input)) return [];
    return input
      .map(item => sanitizeInput.number(item))
      .filter((num): num is number => num !== null);
  }
};

// Validation error formatter
export const formatValidationErrors = (result: ValidationResult): string => {
  if (result.isValid) return '';
  
  let message = result.errors.join('; ');
  
  if (result.warnings && result.warnings.length > 0) {
    message += ` Warnings: ${result.warnings.join('; ')}`;
  }
  
  return message;
};

// Comprehensive validation for API requests
export const validateApiRequest = {
  asteroidDetail: (id: any) => validateAsteroidId(id),
  
  asteroidBatch: (ids: any[]) => validateAsteroidIds(ids),
  
  asteroidSearch: (query: string, limit?: number) => {
    const queryValidation = validateSearchQuery(query);
    if (!queryValidation.isValid) return queryValidation;
    
    if (limit !== undefined) {
      const limitValidation = validatePaginationParams(limit);
      if (!limitValidation.isValid) return limitValidation;
    }
    
    return { isValid: true, errors: [] };
  },
  
  spectralData: (ids: any[]) => validateAsteroidIds(ids),
  
  export: (ids: any[], format: string) => {
    const idsValidation = validateAsteroidIds(ids);
    if (!idsValidation.isValid) return idsValidation;
    
    const formatValidation = validateExportFormat(format);
    if (!formatValidation.isValid) return formatValidation;
    
    return { isValid: true, errors: [] };
  },
  
  classification: (system: string, limit?: number, offset?: number) => {
    const systemValidation = validateClassificationSystem(system);
    if (!systemValidation.isValid) return systemValidation;
    
    const paginationValidation = validatePaginationParams(limit, offset);
    if (!paginationValidation.isValid) return paginationValidation;
    
    return { isValid: true, errors: [] };
  }
};