import {
  validateAsteroidId,
  validateAsteroidIds,
  validateSearchQuery,
  validatePaginationParams,
  validateExportFormat,
  validateClassificationSystem,
  validateRequiredFields,
  sanitizeInput,
  formatValidationErrors,
  validateApiRequest,
} from '../validation';

describe('Validation Utils', () => {
  describe('validateAsteroidId', () => {
    it('validates positive integers', () => {
      const result = validateAsteroidId(123);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects null/undefined values', () => {
      expect(validateAsteroidId(null).isValid).toBe(false);
      expect(validateAsteroidId(undefined).isValid).toBe(false);
    });

    it('rejects non-numeric values', () => {
      const result = validateAsteroidId('abc');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid ID must be a valid number');
    });

    it('rejects non-integer values', () => {
      const result = validateAsteroidId(123.45);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid ID must be an integer');
    });

    it('rejects negative values', () => {
      const result = validateAsteroidId(-1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid ID must be positive');
    });

    it('rejects zero', () => {
      const result = validateAsteroidId(0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid ID must be positive');
    });

    it('rejects very large values', () => {
      const result = validateAsteroidId(9999999999);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid ID is too large');
    });
  });

  describe('validateAsteroidIds', () => {
    it('validates array of valid IDs', () => {
      const result = validateAsteroidIds([1, 2, 3]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects non-array input', () => {
      const result = validateAsteroidIds('not an array' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Asteroid IDs must be provided as an array');
    });

    it('rejects empty arrays', () => {
      const result = validateAsteroidIds([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one asteroid ID must be provided');
    });

    it('rejects arrays that are too large', () => {
      const largeArray = Array.from({ length: 101 }, (_, i) => i + 1);
      const result = validateAsteroidIds(largeArray);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 100 asteroid IDs can be processed at once');
    });

    it('warns about large arrays', () => {
      const largeArray = Array.from({ length: 60 }, (_, i) => i + 1);
      const result = validateAsteroidIds(largeArray);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large number of asteroids may take longer to process');
    });

    it('identifies invalid IDs in array', () => {
      const result = validateAsteroidIds([1, 'invalid', -1]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid asteroid IDs found');
    });

    it('identifies duplicate IDs', () => {
      const result = validateAsteroidIds([1, 2, 1, 3]);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Duplicate asteroid IDs found: 1');
    });
  });

  describe('validateSearchQuery', () => {
    it('validates normal search queries', () => {
      const result = validateSearchQuery('asteroid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects null/undefined queries', () => {
      expect(validateSearchQuery(null as any).isValid).toBe(false);
      expect(validateSearchQuery(undefined as any).isValid).toBe(false);
    });

    it('rejects non-string queries', () => {
      const result = validateSearchQuery(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query is required');
    });

    it('rejects empty queries', () => {
      const result = validateSearchQuery('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query cannot be empty');
    });

    it('rejects queries that are too short', () => {
      const result = validateSearchQuery('a');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query must be at least 2 characters long');
    });

    it('rejects queries that are too long', () => {
      const longQuery = 'a'.repeat(101);
      const result = validateSearchQuery(longQuery);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query is too long (maximum 100 characters)');
    });

    it('warns about special characters', () => {
      const result = validateSearchQuery('test<script>');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Search query contains special characters that may affect results');
    });
  });

  describe('validatePaginationParams', () => {
    it('validates valid pagination params', () => {
      const result = validatePaginationParams(10, 0);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('allows undefined params', () => {
      const result = validatePaginationParams();
      expect(result.isValid).toBe(true);
    });

    it('rejects invalid limit values', () => {
      expect(validatePaginationParams(0).isValid).toBe(false);
      expect(validatePaginationParams(-1).isValid).toBe(false);
      expect(validatePaginationParams(1001).isValid).toBe(false);
    });

    it('warns about large limits', () => {
      const result = validatePaginationParams(500);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large limit values may impact performance');
    });

    it('rejects negative offset', () => {
      const result = validatePaginationParams(10, -1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Offset must be a non-negative integer');
    });
  });

  describe('validateExportFormat', () => {
    it('validates supported formats', () => {
      expect(validateExportFormat('csv').isValid).toBe(true);
      expect(validateExportFormat('json').isValid).toBe(true);
      expect(validateExportFormat('png').isValid).toBe(true);
      expect(validateExportFormat('svg').isValid).toBe(true);
    });

    it('is case insensitive', () => {
      expect(validateExportFormat('CSV').isValid).toBe(true);
      expect(validateExportFormat('Json').isValid).toBe(true);
    });

    it('rejects unsupported formats', () => {
      const result = validateExportFormat('pdf');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid export format. Supported formats: csv, json, png, svg');
    });

    it('rejects null/undefined formats', () => {
      expect(validateExportFormat(null as any).isValid).toBe(false);
      expect(validateExportFormat(undefined as any).isValid).toBe(false);
    });
  });

  describe('validateClassificationSystem', () => {
    it('validates supported systems', () => {
      expect(validateClassificationSystem('bus_demeo').isValid).toBe(true);
      expect(validateClassificationSystem('tholen').isValid).toBe(true);
    });

    it('is case insensitive', () => {
      expect(validateClassificationSystem('BUS_DEMEO').isValid).toBe(true);
      expect(validateClassificationSystem('Tholen').isValid).toBe(true);
    });

    it('rejects unsupported systems', () => {
      const result = validateClassificationSystem('invalid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid classification system. Supported systems: bus_demeo, tholen');
    });
  });

  describe('validateRequiredFields', () => {
    it('validates objects with all required fields', () => {
      const obj = { field1: 'value1', field2: 'value2' };
      const result = validateRequiredFields(obj, ['field1', 'field2']);
      expect(result.isValid).toBe(true);
    });

    it('rejects objects missing required fields', () => {
      const obj = { field1: 'value1' };
      const result = validateRequiredFields(obj, ['field1', 'field2']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Required field \'field2\' is missing');
    });

    it('rejects null/undefined objects', () => {
      expect(validateRequiredFields(null, ['field1']).isValid).toBe(false);
      expect(validateRequiredFields(undefined, ['field1']).isValid).toBe(false);
    });

    it('rejects fields with null values', () => {
      const obj = { field1: null };
      const result = validateRequiredFields(obj, ['field1']);
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    describe('string sanitization', () => {
      it('removes dangerous characters', () => {
        const input = '<script>alert("xss")</script>';
        const result = sanitizeInput.string(input);
        expect(result).toBe('scriptalert(xss)/script');
      });

      it('trims whitespace', () => {
        const result = sanitizeInput.string('  test  ');
        expect(result).toBe('test');
      });

      it('converts non-strings to strings', () => {
        const result = sanitizeInput.string(123 as any);
        expect(result).toBe('123');
      });
    });

    describe('number sanitization', () => {
      it('converts valid numbers', () => {
        expect(sanitizeInput.number('123')).toBe(123);
        expect(sanitizeInput.number(123.45)).toBe(123.45);
      });

      it('returns null for invalid numbers', () => {
        expect(sanitizeInput.number('abc')).toBeNull();
        expect(sanitizeInput.number(null)).toBeNull();
      });
    });

    describe('number array sanitization', () => {
      it('filters valid numbers', () => {
        const input = [1, '2', 'abc', 3.5];
        const result = sanitizeInput.numberArray(input);
        expect(result).toEqual([1, 2, 3.5]);
      });

      it('returns empty array for non-arrays', () => {
        const result = sanitizeInput.numberArray('not an array' as any);
        expect(result).toEqual([]);
      });
    });
  });

  describe('formatValidationErrors', () => {
    it('formats errors and warnings', () => {
      const result = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1']
      };
      const formatted = formatValidationErrors(result);
      expect(formatted).toBe('Error 1; Error 2 Warnings: Warning 1');
    });

    it('returns empty string for valid results', () => {
      const result = { isValid: true, errors: [] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toBe('');
    });

    it('handles results without warnings', () => {
      const result = { isValid: false, errors: ['Error 1'] };
      const formatted = formatValidationErrors(result);
      expect(formatted).toBe('Error 1');
    });
  });

  describe('validateApiRequest', () => {
    it('validates asteroid detail requests', () => {
      const result = validateApiRequest.asteroidDetail(123);
      expect(result.isValid).toBe(true);
    });

    it('validates asteroid batch requests', () => {
      const result = validateApiRequest.asteroidBatch([1, 2, 3]);
      expect(result.isValid).toBe(true);
    });

    it('validates search requests', () => {
      const result = validateApiRequest.asteroidSearch('test', 10);
      expect(result.isValid).toBe(true);
    });

    it('validates export requests', () => {
      const result = validateApiRequest.export([1, 2], 'csv');
      expect(result.isValid).toBe(true);
    });

    it('validates classification requests', () => {
      const result = validateApiRequest.classification('bus_demeo', 10, 0);
      expect(result.isValid).toBe(true);
    });
  });
});