"""
Tests for backend validation utilities.
"""
import pytest
from unittest.mock import Mock, patch
from flask import Flask, request
from app.utils.validation import (
    ValidationError,
    ValidationResult,
    validate_asteroid_id,
    validate_asteroid_ids,
    validate_search_query,
    validate_pagination_params,
    validate_export_format,
    validate_classification_system,
    validate_json_request,
    sanitize_input,
    validate_request,
    validate_asteroid_detail_request,
    validate_asteroid_batch_request,
    validate_asteroid_search_request,
    validate_classification_request,
    validate_export_request
)


class TestValidationResult:
    """Test ValidationResult class."""
    
    def test_init_valid(self):
        result = ValidationResult()
        assert result.is_valid is True
        assert result.errors == []
        assert result.warnings == []
    
    def test_init_invalid(self):
        result = ValidationResult(False, ['error1'], ['warning1'])
        assert result.is_valid is False
        assert result.errors == ['error1']
        assert result.warnings == ['warning1']
    
    def test_add_error(self):
        result = ValidationResult()
        result.add_error('test error')
        assert result.is_valid is False
        assert 'test error' in result.errors
    
    def test_add_warning(self):
        result = ValidationResult()
        result.add_warning('test warning')
        assert result.is_valid is True
        assert 'test warning' in result.warnings
    
    def test_to_dict(self):
        result = ValidationResult(False, ['error1'], ['warning1'])
        expected = {
            'is_valid': False,
            'errors': ['error1'],
            'warnings': ['warning1']
        }
        assert result.to_dict() == expected


class TestValidateAsteroidId:
    """Test asteroid ID validation."""
    
    def test_valid_id(self):
        result = validate_asteroid_id(123)
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_none_id(self):
        result = validate_asteroid_id(None)
        assert result.is_valid is False
        assert 'Asteroid ID is required' in result.errors
    
    def test_invalid_type(self):
        result = validate_asteroid_id('abc')
        assert result.is_valid is False
        assert 'Asteroid ID must be a valid integer' in result.errors
    
    def test_negative_id(self):
        result = validate_asteroid_id(-1)
        assert result.is_valid is False
        assert 'Asteroid ID must be positive' in result.errors
    
    def test_zero_id(self):
        result = validate_asteroid_id(0)
        assert result.is_valid is False
        assert 'Asteroid ID must be positive' in result.errors
    
    def test_large_id(self):
        result = validate_asteroid_id(9999999999)
        assert result.is_valid is False
        assert 'Asteroid ID is too large' in result.errors


class TestValidateAsteroidIds:
    """Test asteroid IDs array validation."""
    
    def test_valid_ids(self):
        result = validate_asteroid_ids([1, 2, 3])
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_not_list(self):
        result = validate_asteroid_ids('not a list')
        assert result.is_valid is False
        assert 'Asteroid IDs must be provided as an array' in result.errors
    
    def test_empty_list(self):
        result = validate_asteroid_ids([])
        assert result.is_valid is False
        assert 'At least one asteroid ID must be provided' in result.errors
    
    def test_too_many_ids(self):
        large_list = list(range(1, 102))  # 101 items
        result = validate_asteroid_ids(large_list)
        assert result.is_valid is False
        assert 'Maximum 100 asteroid IDs can be processed at once' in result.errors
    
    def test_large_list_warning(self):
        large_list = list(range(1, 61))  # 60 items
        result = validate_asteroid_ids(large_list)
        assert result.is_valid is True
        assert 'Large number of asteroids may take longer to process' in result.warnings
    
    def test_invalid_ids_in_list(self):
        result = validate_asteroid_ids([1, 'invalid', -1])
        assert result.is_valid is False
        assert 'Invalid asteroid IDs:' in result.errors[0]
    
    def test_duplicate_ids(self):
        result = validate_asteroid_ids([1, 2, 1, 3])
        assert result.is_valid is True
        assert 'Duplicate asteroid IDs found: 1' in result.warnings


class TestValidateSearchQuery:
    """Test search query validation."""
    
    def test_valid_query(self):
        result = validate_search_query('asteroid')
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_none_query(self):
        result = validate_search_query(None)
        assert result.is_valid is False
        assert 'Search query is required and must be a string' in result.errors
    
    def test_empty_query(self):
        result = validate_search_query('   ')
        assert result.is_valid is False
        assert 'Search query cannot be empty' in result.errors
    
    def test_short_query(self):
        result = validate_search_query('a')
        assert result.is_valid is False
        assert 'Search query must be at least 2 characters long' in result.errors
    
    def test_long_query(self):
        long_query = 'a' * 101
        result = validate_search_query(long_query)
        assert result.is_valid is False
        assert 'Search query is too long (maximum 100 characters)' in result.errors
    
    def test_special_characters_warning(self):
        result = validate_search_query('test<script>')
        assert result.is_valid is True
        assert 'Search query contains special characters that may affect results' in result.warnings


class TestValidatePaginationParams:
    """Test pagination parameters validation."""
    
    def test_valid_params(self):
        result = validate_pagination_params(10, 0)
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_none_params(self):
        result = validate_pagination_params()
        assert result.is_valid is True
    
    def test_invalid_limit(self):
        result = validate_pagination_params(0)
        assert result.is_valid is False
        assert 'Limit must be a positive integer' in result.errors
    
    def test_large_limit_warning(self):
        result = validate_pagination_params(500)
        assert result.is_valid is True
        assert 'Large limit values may impact performance' in result.warnings
    
    def test_negative_offset(self):
        result = validate_pagination_params(10, -1)
        assert result.is_valid is False
        assert 'Offset must be a non-negative integer' in result.errors


class TestValidateExportFormat:
    """Test export format validation."""
    
    def test_valid_formats(self):
        for fmt in ['csv', 'json', 'png', 'svg']:
            result = validate_export_format(fmt)
            assert result.is_valid is True
    
    def test_case_insensitive(self):
        result = validate_export_format('CSV')
        assert result.is_valid is True
    
    def test_invalid_format(self):
        result = validate_export_format('pdf')
        assert result.is_valid is False
        assert 'Invalid export format' in result.errors[0]
    
    def test_none_format(self):
        result = validate_export_format(None)
        assert result.is_valid is False
        assert 'Export format is required and must be a string' in result.errors


class TestValidateClassificationSystem:
    """Test classification system validation."""
    
    def test_valid_systems(self):
        for system in ['bus_demeo', 'tholen']:
            result = validate_classification_system(system)
            assert result.is_valid is True
    
    def test_case_insensitive(self):
        result = validate_classification_system('BUS_DEMEO')
        assert result.is_valid is True
    
    def test_invalid_system(self):
        result = validate_classification_system('invalid')
        assert result.is_valid is False
        assert 'Invalid classification system' in result.errors[0]


class TestSanitizeInput:
    """Test input sanitization."""
    
    def test_sanitize_string(self):
        result = sanitize_input('<script>alert("xss")</script>', 'string')
        assert '<' not in result
        assert '>' not in result
        assert '"' not in result
    
    def test_sanitize_int(self):
        assert sanitize_input('123', 'int') == 123
        assert sanitize_input('abc', 'int') is None
    
    def test_sanitize_float(self):
        assert sanitize_input('123.45', 'float') == 123.45
        assert sanitize_input('abc', 'float') is None
    
    def test_sanitize_list(self):
        result = sanitize_input(['<script>', 'safe'], 'list')
        assert 'script' in result[0]
        assert '<' not in result[0]


class TestValidateRequest:
    """Test request validation decorator."""
    
    def test_validation_decorator(self):
        app = Flask(__name__)
        
        def mock_validation():
            return ValidationResult(True)
        
        @validate_request(mock_validation)
        def test_endpoint():
            return {'status': 'success'}
        
        with app.test_request_context():
            result = test_endpoint()
            assert result == {'status': 'success'}
    
    def test_validation_failure(self):
        app = Flask(__name__)
        
        def mock_validation():
            result = ValidationResult(False)
            result.add_error('Test error')
            return result
        
        @validate_request(mock_validation)
        def test_endpoint():
            return {'status': 'success'}
        
        with app.test_request_context():
            result, status_code = test_endpoint()
            assert status_code == 400
            payload = result.get_json() if hasattr(result, 'get_json') else result
            assert 'Test error' in payload['message']


class TestSpecificValidationFunctions:
    """Test specific validation functions for endpoints."""
    
    def test_validate_asteroid_detail_request(self):
        app = Flask(__name__)
        
        with app.test_request_context('/asteroids/123'):
            # Mock the request.view_args directly
            from flask import request
            request.view_args = {'asteroid_id': '123'}
            result = validate_asteroid_detail_request()
            assert result.is_valid is True
    
    def test_validate_asteroid_batch_request(self):
        app = Flask(__name__)
        
        with app.test_request_context(
            '/asteroids/batch',
            method='POST',
            json={'asteroid_ids': [1, 2, 3]},
            content_type='application/json'
        ):
            result = validate_asteroid_batch_request()
            assert result.is_valid is True
    
    def test_validate_asteroid_search_request(self):
        app = Flask(__name__)
        
        with app.test_request_context('/asteroids/search?q=test&limit=10'):
            result = validate_asteroid_search_request()
            assert result.is_valid is True
    
    def test_validate_classification_request(self):
        app = Flask(__name__)
        
        with app.test_request_context('/classifications/bus_demeo/asteroids?limit=10&offset=0'):
            # Mock the request attributes directly
            from flask import request
            request.view_args = {'system': 'bus_demeo'}
            result = validate_classification_request()
            assert result.is_valid is True
    
    def test_validate_export_request(self):
        app = Flask(__name__)
        
        with app.test_request_context(
            '/export/data',
            method='POST',
            json={'asteroid_ids': [1, 2, 3], 'format': 'csv'},
            content_type='application/json'
        ):
            result = validate_export_request()
            assert result.is_valid is True


class TestValidationError:
    """Test ValidationError exception."""
    
    def test_validation_error_creation(self):
        error = ValidationError('Test message', 'test_field', 'TEST_CODE')
        assert str(error) == 'Test message'
        assert error.field == 'test_field'
        assert error.code == 'TEST_CODE'
    
    def test_validation_error_defaults(self):
        error = ValidationError('Test message')
        assert error.field is None
        assert error.code == 'VALIDATION_ERROR'
