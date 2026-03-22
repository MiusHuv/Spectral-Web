"""
Enhanced error handling utilities for the Flask application.
"""
import traceback
from typing import Dict, Any, Optional
from flask import jsonify, request, current_app
from werkzeug.exceptions import HTTPException
from app.utils.validation import ValidationError


class ApiError(Exception):
    """Custom API error with status code and additional data."""
    
    def __init__(self, message: str, status_code: int = 500, payload: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload or {}


class DatabaseError(ApiError):
    """Database-specific error."""
    
    def __init__(self, message: str = "Database operation failed", original_error: Optional[Exception] = None):
        super().__init__(message, 500)
        self.original_error = original_error


class DataNotFoundError(ApiError):
    """Data not found error."""
    
    def __init__(self, message: str = "Requested data not found", resource_type: str = "resource"):
        super().__init__(message, 404)
        self.resource_type = resource_type


class RateLimitError(ApiError):
    """Rate limiting error."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None):
        super().__init__(message, 429)
        if retry_after:
            self.payload['retry_after'] = retry_after


def create_error_response(
    error_type: str,
    message: str,
    status_code: int,
    details: Optional[Dict[str, Any]] = None,
    context: Optional[str] = None
) -> tuple:
    """Create a standardized error response with enhanced suggestions."""
    
    # Get comprehensive error suggestions
    error_suggestions = get_error_suggestions(status_code, error_type, context)
    
    response_data = {
        'error': error_type,
        'message': message,
        'status_code': status_code,
        'status': 'error',
        'timestamp': current_app.config.get('TESTING') and '2023-01-01T00:00:00Z' or None,
        'request_id': getattr(request, 'id', None),
        'suggestions': {
            'message': error_suggestions['message'],
            'actions': error_suggestions['actions'],
            'is_retryable': status_code in [408, 429, 500, 502, 503, 504],
            'retry_after': error_suggestions.get('retry_after')
        }
    }
    
    # Add timestamp in non-testing environments
    if not current_app.config.get('TESTING'):
        from datetime import datetime
        response_data['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    
    if details:
        response_data['details'] = details
    
    # Add technical details in development
    if current_app.debug:
        response_data['technical'] = {
            'description': error_suggestions['technical'],
            'request_info': {
                'method': request.method,
                'url': request.url,
                'endpoint': request.endpoint,
                'user_agent': request.headers.get('User-Agent', 'Unknown')
            }
        }
    
    # Add retry-after header for rate limiting
    response = jsonify(response_data)
    if status_code == 429 and error_suggestions.get('retry_after'):
        response.headers['Retry-After'] = str(error_suggestions['retry_after'])
    
    return response, status_code


def get_error_suggestions(status_code: int, error_type: str = None, context: str = None) -> Dict[str, Any]:
    """Get comprehensive error suggestions based on status code and context."""
    
    base_suggestions = {
        400: {
            "message": "The request format is invalid.",
            "actions": [
                "Check that all required parameters are provided",
                "Verify parameter formats (numbers, dates, etc.)",
                "Refresh the page and try again"
            ],
            "technical": "Bad Request - Invalid request format or parameters"
        },
        401: {
            "message": "Authentication is required.",
            "actions": [
                "Refresh the page to renew your session",
                "Clear browser cache and cookies",
                "Contact support if the problem persists"
            ],
            "technical": "Unauthorized - Authentication required"
        },
        403: {
            "message": "You don't have permission to access this resource.",
            "actions": [
                "Contact your administrator for access",
                "Verify you're using the correct account",
                "Check if your permissions have changed"
            ],
            "technical": "Forbidden - Insufficient permissions"
        },
        404: {
            "message": "The requested data was not found.",
            "actions": [
                "Verify the resource identifier is correct",
                "Check if the data has been moved or deleted",
                "Try browsing available data instead"
            ],
            "technical": "Not Found - Resource does not exist"
        },
        405: {
            "message": "This operation is not allowed.",
            "actions": [
                "Use the correct request method",
                "Check the API documentation",
                "Contact support if you believe this is an error"
            ],
            "technical": "Method Not Allowed - HTTP method not supported"
        },
        409: {
            "message": "There's a conflict with the current state.",
            "actions": [
                "Refresh the page to get the latest data",
                "Check for concurrent modifications",
                "Try the operation again"
            ],
            "technical": "Conflict - Resource state conflict"
        },
        413: {
            "message": "The request is too large.",
            "actions": [
                "Select fewer items to reduce request size",
                "Break large requests into smaller chunks",
                "Contact support for higher limits"
            ],
            "technical": "Payload Too Large - Request exceeds size limits"
        },
        422: {
            "message": "The request data is invalid.",
            "actions": [
                "Check data format and validation rules",
                "Verify all required fields are provided",
                "Review input constraints and try again"
            ],
            "technical": "Unprocessable Entity - Data validation failed"
        },
        429: {
            "message": "Too many requests. Please slow down.",
            "actions": [
                "Wait 30 seconds before trying again",
                "Reduce the frequency of requests",
                "Consider using batch operations"
            ],
            "technical": "Too Many Requests - Rate limit exceeded",
            "retry_after": 30
        },
        500: {
            "message": "The server encountered an internal error.",
            "actions": [
                "Try the operation again in a few moments",
                "Check if the issue persists",
                "Contact support if the problem continues"
            ],
            "technical": "Internal Server Error - Unexpected server condition"
        },
        502: {
            "message": "The server received an invalid response.",
            "actions": [
                "Try again in a few minutes",
                "Check server status page",
                "Contact support if the issue persists"
            ],
            "technical": "Bad Gateway - Invalid upstream response"
        },
        503: {
            "message": "The service is temporarily unavailable.",
            "actions": [
                "Wait a few minutes and try again",
                "Check service status page",
                "Try again during off-peak hours"
            ],
            "technical": "Service Unavailable - Temporary service interruption"
        },
        504: {
            "message": "The request timed out.",
            "actions": [
                "Try reducing the amount of data requested",
                "Check your internet connection",
                "Try again with a smaller request"
            ],
            "technical": "Gateway Timeout - Request processing timeout"
        }
    }
    
    # Get base suggestion or default
    suggestion = base_suggestions.get(status_code, {
        "message": "An unexpected error occurred.",
        "actions": [
            "Try the operation again",
            "Refresh the page if the problem persists",
            "Contact support for assistance"
        ],
        "technical": f"HTTP {status_code} - Unexpected error"
    })
    
    # Add context-specific suggestions
    if context:
        if context == "database" and status_code == 500:
            suggestion["actions"].insert(0, "The database may be temporarily unavailable")
        elif context == "network" and status_code in [502, 503, 504]:
            suggestion["actions"].insert(0, "Check your internet connection")
        elif context == "validation" and status_code == 422:
            suggestion["actions"].insert(0, "Review the data format requirements")
    
    return suggestion


def register_error_handlers(app):
    """Register comprehensive error handlers with the Flask app."""
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(error):
        """Handle validation errors."""
        current_app.logger.warning(f'Validation error: {str(error)}')
        
        details = {
            'field': error.field,
            'code': error.code
        }
        
        return create_error_response(
            'Validation Error',
            str(error),
            400,
            details=details,
            context="validation"
        )
    
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        """Handle custom API errors."""
        current_app.logger.error(f'API error: {error.message}')
        
        return create_error_response(
            'API Error',
            error.message,
            error.status_code,
            details=error.payload
        )
    
    @app.errorhandler(DatabaseError)
    def handle_database_error(error):
        """Handle database errors."""
        current_app.logger.error(f'Database error: {error.message}')
        
        # Don't expose internal database errors in production
        if current_app.debug and error.original_error:
            details = {
                'original_error': str(error.original_error),
                'type': type(error.original_error).__name__
            }
        else:
            details = None
        
        return create_error_response(
            'Database Error',
            error.message if current_app.debug else 'A database error occurred',
            500,
            details=details,
            context="database"
        )
    
    @app.errorhandler(DataNotFoundError)
    def handle_data_not_found_error(error):
        """Handle data not found errors."""
        current_app.logger.info(f'Data not found: {error.message}')
        
        return create_error_response(
            'Not Found',
            error.message,
            404,
            details={'resource_type': error.resource_type}
        )
    
    @app.errorhandler(RateLimitError)
    def handle_rate_limit_error(error):
        """Handle rate limiting errors."""
        current_app.logger.warning(f'Rate limit exceeded: {error.message}')
        
        # Create response with custom retry_after if provided
        response, status_code = create_error_response(
            'Rate Limit Exceeded',
            error.message,
            429,
            details=error.payload
        )
        
        # Override retry-after header if specified in error payload
        if 'retry_after' in error.payload:
            response.headers['Retry-After'] = str(error.payload['retry_after'])
        
        return response, status_code
    
    @app.errorhandler(400)
    def handle_bad_request(error):
        """Handle bad request errors."""
        current_app.logger.warning(f'Bad request: {error}')
        
        return create_error_response(
            'Bad Request',
            'The request could not be understood by the server.',
            400
        )
    
    @app.errorhandler(401)
    def handle_unauthorized(error):
        """Handle unauthorized errors."""
        current_app.logger.warning(f'Unauthorized access attempt: {error}')
        
        return create_error_response(
            'Unauthorized',
            'Authentication is required to access this resource.',
            401
        )
    
    @app.errorhandler(403)
    def handle_forbidden(error):
        """Handle forbidden errors."""
        current_app.logger.warning(f'Forbidden access attempt: {error}')
        
        return create_error_response(
            'Forbidden',
            'You do not have permission to access this resource.',
            403
        )
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Handle not found errors."""
        current_app.logger.info(f'Resource not found: {request.url}')
        
        return create_error_response(
            'Not Found',
            'The requested resource was not found.',
            404
        )
    
    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        """Handle method not allowed errors."""
        current_app.logger.warning(f'Method not allowed: {request.method} {request.url}')
        
        return create_error_response(
            'Method Not Allowed',
            f'The {request.method} method is not allowed for this endpoint.',
            405
        )
    
    @app.errorhandler(413)
    def handle_payload_too_large(error):
        """Handle payload too large errors."""
        current_app.logger.warning(f'Payload too large: {request.url}')
        
        return create_error_response(
            'Payload Too Large',
            'The request payload is too large.',
            413
        )
    
    @app.errorhandler(422)
    def handle_unprocessable_entity(error):
        """Handle unprocessable entity errors."""
        current_app.logger.warning(f'Unprocessable entity: {error}')
        
        return create_error_response(
            'Unprocessable Entity',
            'The request data is invalid or malformed.',
            422,
            context="validation"
        )
    
    @app.errorhandler(429)
    def handle_too_many_requests(error):
        """Handle too many requests errors."""
        current_app.logger.warning(f'Too many requests: {request.remote_addr}')
        
        return create_error_response(
            'Too Many Requests',
            'Rate limit exceeded. Please try again later.',
            429
        )
    
    @app.errorhandler(500)
    def handle_internal_server_error(error):
        """Handle internal server errors."""
        current_app.logger.error(f'Internal server error: {error}')
        
        # Log full traceback in development
        if current_app.debug:
            current_app.logger.error(f'Traceback: {traceback.format_exc()}')
        
        return create_error_response(
            'Internal Server Error',
            'An unexpected error occurred on the server.',
            500
        )
    
    @app.errorhandler(502)
    def handle_bad_gateway(error):
        """Handle bad gateway errors."""
        current_app.logger.error(f'Bad gateway: {error}')
        
        return create_error_response(
            'Bad Gateway',
            'The server received an invalid response from an upstream server.',
            502,
            context="network"
        )
    
    @app.errorhandler(503)
    def handle_service_unavailable(error):
        """Handle service unavailable errors."""
        current_app.logger.error(f'Service unavailable: {error}')
        
        return create_error_response(
            'Service Unavailable',
            'The service is temporarily unavailable.',
            503
        )
    
    @app.errorhandler(504)
    def handle_gateway_timeout(error):
        """Handle gateway timeout errors."""
        current_app.logger.error(f'Gateway timeout: {error}')
        
        return create_error_response(
            'Gateway Timeout',
            'The server did not receive a timely response from an upstream server.',
            504,
            context="network"
        )
    
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        """Handle any unexpected errors."""
        current_app.logger.error(f'Unexpected error: {error}')
        current_app.logger.error(f'Traceback: {traceback.format_exc()}')
        
        # Don't expose internal errors in production
        if current_app.debug:
            details = {
                'error_type': type(error).__name__,
                'traceback': traceback.format_exc()
            }
        else:
            details = None
        
        return create_error_response(
            'Internal Server Error',
            'An unexpected error occurred.',
            500,
            details=details
        )


def safe_execute(operation, error_message: str = "Operation failed", 
                 error_type: type = ApiError, **error_kwargs):
    """
    Safely execute an operation with error handling.
    
    Args:
        operation: Function to execute
        error_message: Default error message if operation fails
        error_type: Type of error to raise on failure
        **error_kwargs: Additional arguments for the error constructor
    
    Returns:
        Result of the operation
    
    Raises:
        error_type: If the operation fails
    """
    try:
        return operation()
    except Exception as e:
        current_app.logger.error(f'{error_message}: {e}')
        
        if isinstance(e, (ApiError, ValidationError)):
            raise e
        
        # Wrap other exceptions in the specified error type
        if error_type == DatabaseError:
            raise DatabaseError(error_message, original_error=e)
        else:
            raise error_type(error_message, **error_kwargs)


def graceful_degradation(fallback_value=None, log_error: bool = True):
    """
    Decorator for graceful degradation when operations fail.
    
    Args:
        fallback_value: Value to return if operation fails
        log_error: Whether to log the error
    
    Returns:
        Decorator function
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if log_error:
                    current_app.logger.warning(f'Graceful degradation in {func.__name__}: {e}')
                return fallback_value
        return wrapper
    return decorator