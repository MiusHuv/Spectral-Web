"""
Backend validation utilities for API requests and data processing.
"""
import re
from typing import Any, Dict, List, Optional, Tuple, Union
from functools import wraps
from flask import request, jsonify, current_app


class ValidationError(Exception):
    """Custom validation error with field and code information."""
    
    def __init__(self, message: str, field: Optional[str] = None, code: str = 'VALIDATION_ERROR'):
        super().__init__(message)
        self.field = field
        self.code = code


class ValidationResult:
    """Result of a validation operation."""
    
    def __init__(self, is_valid: bool = True, errors: Optional[List[str]] = None, 
                 warnings: Optional[List[str]] = None):
        self.is_valid = is_valid
        self.errors = errors or []
        self.warnings = warnings or []
    
    def add_error(self, error: str):
        """Add an error to the result."""
        self.errors.append(error)
        self.is_valid = False
    
    def add_warning(self, warning: str):
        """Add a warning to the result."""
        self.warnings.append(warning)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'is_valid': self.is_valid,
            'errors': self.errors,
            'warnings': self.warnings
        }


def validate_asteroid_id(asteroid_id: Any) -> ValidationResult:
    """Validate asteroid ID parameter."""
    result = ValidationResult()
    
    if asteroid_id is None:
        result.add_error('Asteroid ID is required')
        return result
    
    try:
        id_int = int(asteroid_id)
    except (ValueError, TypeError):
        result.add_error('Asteroid ID must be a valid integer')
        return result
    
    if id_int <= 0:
        result.add_error('Asteroid ID must be positive')
    elif id_int > 999999999:
        result.add_error('Asteroid ID is too large')
    
    return result


def validate_asteroid_ids(asteroid_ids: Any, max_count: int = 100) -> ValidationResult:
    """Validate array of asteroid IDs."""
    result = ValidationResult()
    
    if not isinstance(asteroid_ids, list):
        result.add_error('Asteroid IDs must be provided as an array')
        return result
    
    if len(asteroid_ids) == 0:
        result.add_error('At least one asteroid ID must be provided')
        return result
    
    if len(asteroid_ids) > max_count:
        result.add_error(f'Maximum {max_count} asteroid IDs can be processed at once')
    
    if len(asteroid_ids) > 50:
        result.add_warning('Large number of asteroids may take longer to process')
    
    # Validate individual IDs
    invalid_ids = []
    duplicate_ids = []
    seen_ids = set()
    
    for i, asteroid_id in enumerate(asteroid_ids):
        id_validation = validate_asteroid_id(asteroid_id)
        if not id_validation.is_valid:
            invalid_ids.append(f'Index {i}: {", ".join(id_validation.errors)}')
        else:
            id_int = int(asteroid_id)
            if id_int in seen_ids:
                duplicate_ids.append(str(id_int))
            else:
                seen_ids.add(id_int)
    
    if invalid_ids:
        result.add_error(f'Invalid asteroid IDs: {"; ".join(invalid_ids)}')
    
    if duplicate_ids:
        result.add_warning(f'Duplicate asteroid IDs found: {", ".join(duplicate_ids)}')
    
    return result


def validate_search_query(query: Any) -> ValidationResult:
    """Validate search query parameter."""
    result = ValidationResult()
    
    if not query or not isinstance(query, str):
        result.add_error('Search query is required and must be a string')
        return result
    
    query = query.strip()
    
    if len(query) == 0:
        result.add_error('Search query cannot be empty')
    elif len(query) < 2:
        result.add_error('Search query must be at least 2 characters long')
    elif len(query) > 100:
        result.add_error('Search query is too long (maximum 100 characters)')
    
    # Check for potentially problematic characters
    if re.search(r'[<>\'\"&]', query):
        result.add_warning('Search query contains special characters that may affect results')
    
    return result


def validate_pagination_params(limit: Any = None, offset: Any = None) -> ValidationResult:
    """Validate pagination parameters."""
    result = ValidationResult()
    
    if limit is not None:
        try:
            limit_int = int(limit)
            if limit_int < 1:
                result.add_error('Limit must be a positive integer')
            elif limit_int > 1000:
                result.add_error('Limit cannot exceed 1000')
            elif limit_int > 100:
                result.add_warning('Large limit values may impact performance')
        except (ValueError, TypeError):
            result.add_error('Limit must be a valid integer')
    
    if offset is not None:
        try:
            offset_int = int(offset)
            if offset_int < 0:
                result.add_error('Offset must be a non-negative integer')
        except (ValueError, TypeError):
            result.add_error('Offset must be a valid integer')
    
    return result


def validate_export_format(format_str: Any) -> ValidationResult:
    """Validate export format parameter."""
    result = ValidationResult()
    valid_formats = ['csv', 'json', 'png', 'svg']
    
    if not format_str or not isinstance(format_str, str):
        result.add_error('Export format is required and must be a string')
        return result
    
    if format_str.lower() not in valid_formats:
        result.add_error(f'Invalid export format. Supported formats: {", ".join(valid_formats)}')
    
    return result


def validate_classification_system(system: Any) -> ValidationResult:
    """Validate classification system parameter."""
    result = ValidationResult()
    valid_systems = ['bus_demeo', 'tholen']
    
    if not system or not isinstance(system, str):
        result.add_error('Classification system is required and must be a string')
        return result
    
    if system.lower() not in valid_systems:
        result.add_error(f'Invalid classification system. Supported systems: {", ".join(valid_systems)}')
    
    return result


def validate_json_request(required_fields: Optional[List[str]] = None) -> ValidationResult:
    """Validate JSON request body."""
    result = ValidationResult()
    
    if not request.is_json:
        result.add_error('Request must be JSON')
        return result
    
    try:
        data = request.get_json(force=True)
    except Exception:
        result.add_error('Request must be valid JSON')
        return result
    
    if data is None:
        result.add_error('Request body cannot be empty')
        return result
    
    if required_fields:
        for field in required_fields:
            if field not in data or data[field] is None:
                result.add_error(f'Required field "{field}" is missing')
    
    return result


def sanitize_input(value: Any, input_type: str = 'string') -> Any:
    """Sanitize input values to prevent injection attacks."""
    if value is None:
        return None
    
    if input_type == 'string':
        if not isinstance(value, str):
            return str(value)
        # Remove potentially dangerous characters
        return re.sub(r'[<>\'\"&]', '', value.strip())
    
    elif input_type == 'int':
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    elif input_type == 'float':
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    elif input_type == 'list':
        if not isinstance(value, list):
            return []
        return [sanitize_input(item, 'string') for item in value]
    
    return value


def validate_request(validation_func):
    """Decorator for validating API requests."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Run validation
                validation_result = validation_func()
                
                if not validation_result.is_valid:
                    current_app.logger.warning(f'Validation failed for {request.endpoint}: {validation_result.errors}')
                    return {
                        'error': 'Validation Error',
                        'message': '; '.join(validation_result.errors),
                        'details': validation_result.to_dict(),
                        'status': 'error'
                    }, 400
                
                # Log warnings if any
                if validation_result.warnings:
                    current_app.logger.info(f'Validation warnings for {request.endpoint}: {validation_result.warnings}')

            except ValidationError as e:
                current_app.logger.warning(f'Validation error in {request.endpoint}: {e}')
                return {
                    'error': 'Validation Error',
                    'message': str(e),
                    'field': e.field,
                    'code': e.code,
                    'status': 'error'
                }, 400
            
            except Exception as e:
                current_app.logger.error(f'Unexpected error in validation for {request.endpoint}: {e}')
                return {
                    'error': 'Internal Server Error',
                    'message': 'An unexpected error occurred during validation',
                    'status': 'error'
                }, 500

            # Proceed with the original function after validation succeeds.
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


# Specific validation functions for different endpoints
def validate_asteroid_detail_request():
    """Validate asteroid detail request."""
    asteroid_id = request.view_args.get('asteroid_id')
    return validate_asteroid_id(asteroid_id)


def validate_asteroid_batch_request():
    """Validate asteroid batch request."""
    json_validation = validate_json_request(['asteroid_ids'])
    if not json_validation.is_valid:
        return json_validation
    
    data = request.get_json()
    return validate_asteroid_ids(data['asteroid_ids'])


def validate_asteroid_search_request():
    """Validate asteroid search request."""
    result = ValidationResult()
    
    query = request.args.get('q')
    limit = request.args.get('limit', 50)
    
    query_validation = validate_search_query(query)
    if not query_validation.is_valid:
        result.errors.extend(query_validation.errors)
    
    pagination_validation = validate_pagination_params(limit=limit)
    if not pagination_validation.is_valid:
        result.errors.extend(pagination_validation.errors)
    
    result.is_valid = len(result.errors) == 0
    return result


def validate_classification_request():
    """Validate classification request."""
    result = ValidationResult()
    
    system = request.view_args.get('system')
    limit = request.args.get('limit')
    offset = request.args.get('offset')
    
    system_validation = validate_classification_system(system)
    if not system_validation.is_valid:
        result.errors.extend(system_validation.errors)
    
    pagination_validation = validate_pagination_params(limit, offset)
    if not pagination_validation.is_valid:
        result.errors.extend(pagination_validation.errors)
    
    result.is_valid = len(result.errors) == 0
    return result


def validate_export_request():
    """Validate export request."""
    json_validation = validate_json_request(['asteroid_ids', 'format'])
    if not json_validation.is_valid:
        return json_validation
    
    data = request.get_json()
    result = ValidationResult()
    
    ids_validation = validate_asteroid_ids(data['asteroid_ids'])
    if not ids_validation.is_valid:
        result.errors.extend(ids_validation.errors)
    
    format_validation = validate_export_format(data['format'])
    if not format_validation.is_valid:
        result.errors.extend(format_validation.errors)
    
    result.is_valid = len(result.errors) == 0
    return result
