"""
Tests for backend error handling utilities.
"""
import pytest
from unittest.mock import Mock, patch
from flask import Flask, jsonify
from app.utils.error_handlers import (
    ApiError,
    DatabaseError,
    DataNotFoundError,
    RateLimitError,
    create_error_response,
    get_error_suggestions,
    register_error_handlers,
    safe_execute,
    graceful_degradation
)
from app.utils.validation import ValidationError


class TestApiError:
    """Test ApiError exception."""
    
    def test_api_error_creation(self):
        error = ApiError('Test message', 400, {'key': 'value'})
        assert str(error) == 'Test message'
        assert error.status_code == 400
        assert error.payload == {'key': 'value'}
    
    def test_api_error_defaults(self):
        error = ApiError('Test message')
        assert error.status_code == 500
        assert error.payload == {}


class TestDatabaseError:
    """Test DatabaseError exception."""
    
    def test_database_error_creation(self):
        original = Exception('Original error')
        error = DatabaseError('DB failed', original)
        assert str(error) == 'DB failed'
        assert error.status_code == 500
        assert error.original_error == original
    
    def test_database_error_defaults(self):
        error = DatabaseError()
        assert str(error) == 'Database operation failed'
        assert error.original_error is None


class TestDataNotFoundError:
    """Test DataNotFoundError exception."""
    
    def test_data_not_found_error_creation(self):
        error = DataNotFoundError('Not found', 'asteroid')
        assert str(error) == 'Not found'
        assert error.status_code == 404
        assert error.resource_type == 'asteroid'
    
    def test_data_not_found_error_defaults(self):
        error = DataNotFoundError()
        assert str(error) == 'Requested data not found'
        assert error.resource_type == 'resource'


class TestRateLimitError:
    """Test RateLimitError exception."""
    
    def test_rate_limit_error_creation(self):
        error = RateLimitError('Rate limited', 60)
        assert str(error) == 'Rate limited'
        assert error.status_code == 429
        assert error.payload['retry_after'] == 60
    
    def test_rate_limit_error_defaults(self):
        error = RateLimitError()
        assert str(error) == 'Rate limit exceeded'
        assert 'retry_after' not in error.payload


class TestCreateErrorResponse:
    """Test error response creation."""
    
    def test_create_basic_error_response(self):
        app = Flask(__name__)
        
        with app.test_request_context():
            response, status_code = create_error_response(
                'Test Error',
                'Test message',
                400
            )
            
            assert status_code == 400
            data = response.get_json()
            assert data['error'] == 'Test Error'
            assert data['message'] == 'Test message'
            assert data['status_code'] == 400
            assert data['status'] == 'error'
    
    def test_create_error_response_with_details(self):
        app = Flask(__name__)
        
        with app.test_request_context():
            response, status_code = create_error_response(
                'Test Error',
                'Test message',
                400,
                details={'field': 'test'}
            )
            
            data = response.get_json()
            assert data['details'] == {'field': 'test'}
            assert 'suggestions' in data
            assert isinstance(data['suggestions'], dict)
            assert 'message' in data['suggestions']
            assert 'actions' in data['suggestions']
    
    def test_create_error_response_debug_mode(self):
        app = Flask(__name__)
        app.debug = True
        
        with app.test_request_context('/test'):
            response, status_code = create_error_response(
                'Test Error',
                'Test message',
                400
            )
            
            data = response.get_json()
            assert 'technical' in data
            assert 'request_info' in data['technical']
            assert data['technical']['request_info']['method'] == 'GET'
            assert data['technical']['request_info']['url'] == 'http://localhost/test'


class TestGetErrorSuggestions:
    """Test error suggestion generation."""
    
    def test_known_status_codes(self):
        suggestions_400 = get_error_suggestions(400)
        assert 'request format is invalid' in suggestions_400['message']
        assert any('parameters' in action for action in suggestions_400['actions'])
        
        suggestions_401 = get_error_suggestions(401)
        assert 'Authentication is required' in suggestions_401['message']
        
        suggestions_403 = get_error_suggestions(403)
        assert 'permission' in suggestions_403['message']
        
        suggestions_404 = get_error_suggestions(404)
        assert 'not found' in suggestions_404['message']
        
        suggestions_429 = get_error_suggestions(429)
        assert 'Too many requests' in suggestions_429['message']
        assert suggestions_429.get('retry_after') == 30
        
        suggestions_500 = get_error_suggestions(500)
        assert 'internal error' in suggestions_500['message']
    
    def test_unknown_status_code(self):
        suggestion = get_error_suggestions(999)
        assert 'unexpected error' in suggestion['message']
        assert any('try' in action.lower() for action in suggestion['actions'])


class TestErrorHandlers:
    """Test error handler registration and functionality."""
    
    def test_register_error_handlers(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        # Check that error handlers are registered
        assert 400 in app.error_handler_spec[None]
        assert 404 in app.error_handler_spec[None]
        assert 500 in app.error_handler_spec[None]
    
    def test_validation_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            raise ValidationError('Test validation error', 'test_field')
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 400
            data = response.get_json()
            assert data['error'] == 'Validation Error'
            assert data['message'] == 'Test validation error'
            assert data['details']['field'] == 'test_field'
    
    def test_api_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            raise ApiError('Test API error', 422, {'custom': 'data'})
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 422
            data = response.get_json()
            assert data['error'] == 'API Error'
            assert data['message'] == 'Test API error'
            assert data['details']['custom'] == 'data'
    
    def test_database_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            original = Exception('DB connection failed')
            raise DatabaseError('Database error', original)
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 500
            data = response.get_json()
            assert data['error'] == 'Database Error'
    
    def test_data_not_found_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            raise DataNotFoundError('Asteroid not found', 'asteroid')
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 404
            data = response.get_json()
            assert data['error'] == 'Not Found'
            assert data['details']['resource_type'] == 'asteroid'
    
    def test_rate_limit_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            raise RateLimitError('Too many requests', 60)
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 429
            data = response.get_json()
            assert data['error'] == 'Rate Limit Exceeded'
            assert response.headers.get('Retry-After') == '60'
    
    def test_http_error_handlers(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/bad-request')
        def bad_request():
            from werkzeug.exceptions import BadRequest
            raise BadRequest()
        
        @app.route('/not-found')
        def not_found():
            from werkzeug.exceptions import NotFound
            raise NotFound()
        
        with app.test_client() as client:
            # Test 400 handler
            response = client.get('/bad-request')
            assert response.status_code == 400
            data = response.get_json()
            assert data['error'] == 'Bad Request'
            
            # Test 404 handler
            response = client.get('/not-found')
            assert response.status_code == 404
            data = response.get_json()
            assert data['error'] == 'Not Found'
    
    def test_unexpected_error_handler(self):
        app = Flask(__name__)
        register_error_handlers(app)
        
        @app.route('/test')
        def test_route():
            raise RuntimeError('Unexpected error')
        
        with app.test_client() as client:
            response = client.get('/test')
            assert response.status_code == 500
            data = response.get_json()
            assert data['error'] == 'Internal Server Error'


class TestSafeExecute:
    """Test safe execution utility."""
    
    def test_safe_execute_success(self):
        def operation():
            return 'success'
        
        result = safe_execute(operation)
        assert result == 'success'
    
    def test_safe_execute_failure(self):
        app = Flask(__name__)
        
        def operation():
            raise Exception('Test error')
        
        with app.app_context():
            with pytest.raises(ApiError) as exc_info:
                safe_execute(operation, 'Operation failed')
            
            assert str(exc_info.value) == 'Operation failed'
    
    def test_safe_execute_database_error(self):
        app = Flask(__name__)
        
        def operation():
            raise Exception('DB error')
        
        with app.app_context():
            with pytest.raises(DatabaseError) as exc_info:
                safe_execute(operation, 'DB operation failed', DatabaseError)
            
            assert str(exc_info.value) == 'DB operation failed'
            assert exc_info.value.original_error is not None
    
    def test_safe_execute_preserves_custom_errors(self):
        app = Flask(__name__)
        
        def operation():
            raise ValidationError('Validation failed')
        
        with app.app_context():
            with pytest.raises(ValidationError):
                safe_execute(operation)


class TestGracefulDegradation:
    """Test graceful degradation decorator."""
    
    def test_graceful_degradation_success(self):
        @graceful_degradation(fallback_value='fallback')
        def operation():
            return 'success'
        
        result = operation()
        assert result == 'success'
    
    def test_graceful_degradation_failure(self):
        app = Flask(__name__)
        
        @graceful_degradation(fallback_value='fallback')
        def operation():
            raise Exception('Test error')
        
        with app.app_context():
            result = operation()
            assert result == 'fallback'
    
    def test_graceful_degradation_no_logging(self):
        app = Flask(__name__)
        
        @graceful_degradation(fallback_value='fallback', log_error=False)
        def operation():
            raise Exception('Test error')
        
        with app.app_context():
            with patch.object(app.logger, 'warning') as mock_warning:
                result = operation()
                assert result == 'fallback'
                mock_warning.assert_not_called()
    
    def test_graceful_degradation_with_logging(self):
        app = Flask(__name__)
        
        with app.app_context():
            @graceful_degradation(fallback_value='fallback', log_error=True)
            def operation():
                raise Exception('Test error')
            
            with patch.object(app.logger, 'warning') as mock_warning:
                result = operation()
                assert result == 'fallback'
                mock_warning.assert_called_once()