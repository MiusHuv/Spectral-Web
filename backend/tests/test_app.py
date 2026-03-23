"""
Tests for Flask application foundation and basic functionality.
"""
import pytest
import json
import sys
import os
from unittest.mock import Mock, patch

# Add the parent directory to the path so we can import the app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.export_models import ExportResult

@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app('testing')
    return app

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

class TestAppFoundation:
    """Test Flask application foundation."""
    
    def test_app_creation(self, app):
        """Test that app can be created successfully."""
        assert app is not None
        assert app.config['TESTING'] is True
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get('/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert data['service'] == 'asteroid-spectral-api'
    
    def test_cors_headers(self, client):
        """Test CORS headers are present."""
        response = client.get('/health')
        assert 'Access-Control-Allow-Origin' in response.headers
    
    def test_404_error_handler(self, client):
        """Test 404 error handler."""
        response = client.get('/nonexistent-endpoint')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert data['error'] == 'Not Found'
        assert data['status_code'] == 404

class TestClassificationsAPI:
    """Test classifications API endpoints."""
    
    def test_get_classification_systems(self, client):
        """Test getting available classification systems."""
        response = client.get('/api/classifications')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'systems' in data
        assert len(data['systems']) == 2
        
        system_names = [s['name'] for s in data['systems']]
        assert 'bus_demeo' in system_names
        assert 'tholen' in system_names
    
    def test_get_classification_asteroids_valid_system(self, client):
        """Test getting asteroids for valid classification system."""
        response = client.get('/api/classifications/bus_demeo/asteroids')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['system'] == 'bus_demeo'
        assert 'classes' in data
        assert 'pagination' in data
    
    def test_get_classification_asteroids_invalid_system(self, client):
        """Test getting asteroids for invalid classification system."""
        response = client.get('/api/classifications/invalid_system/asteroids')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Invalid classification system' in data['error']
    
    @patch('app.api.classifications.get_data_access')
    def test_get_classification_asteroids_with_pagination(self, mock_get_data_access, client):
        """Test pagination parameters."""
        mock_data_access = Mock()
        mock_data_access.get_asteroids_by_classification.return_value = {
            'classes': [],
            'pagination': {
                'limit': 50,
                'offset': 10,
                'total': 0
            }
        }
        mock_get_data_access.return_value = mock_data_access

        response = client.get('/api/classifications/bus_demeo/asteroids?limit=50&offset=10')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['pagination']['limit'] == 50
        assert data['pagination']['offset'] == 10

class TestAsteroidsAPI:
    """Test asteroids API endpoints."""
    
    @patch('app.api.asteroids.get_data_access')
    def test_get_asteroid_detail_valid_id(self, mock_get_data_access, client):
        """Test getting asteroid detail with valid ID."""
        mock_data_access = Mock()
        mock_data_access.get_asteroid_details.return_value = {
            'id': 1,
            'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
            'classifications': {'bus_demeo_class': 'C'},
            'orbital_elements': {'semi_major_axis': 2.77},
            'physical_properties': {'diameter': 939.4}
        }
        mock_get_data_access.return_value = mock_data_access

        response = client.get('/api/asteroids/1')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'asteroid' in data
        assert data['asteroid']['id'] == 1
    
    def test_get_asteroid_detail_invalid_id(self, client):
        """Test getting asteroid detail with invalid ID."""
        response = client.get('/api/asteroids/invalid')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'valid integer' in data['message']
    
    @patch('app.api.asteroids.get_data_access')
    def test_asteroid_batch_valid_request(self, mock_get_data_access, client):
        """Test batch asteroid request with valid data."""
        mock_data_access = Mock()
        mock_data_access.get_asteroids_batch.return_value = [
            {'id': 1}, {'id': 2}, {'id': 3}
        ]
        mock_get_data_access.return_value = mock_data_access

        request_data = {'asteroid_ids': [1, 2, 3]}
        response = client.post('/api/asteroids/batch', 
                             data=json.dumps(request_data),
                             content_type='application/json')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['asteroids']) == 3
        assert data['requested_count'] == 3
    
    def test_asteroid_batch_invalid_request(self, client):
        """Test batch asteroid request with invalid data."""
        request_data = {'invalid_field': [1, 2, 3]}
        response = client.post('/api/asteroids/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert data['status'] == 'error'

class TestSpectralAPI:
    """Test spectral data API endpoints."""
    
    @patch('app.api.spectral.get_data_access')
    def test_get_asteroid_spectrum_valid_id(self, mock_get_data_access, client):
        """Test getting spectrum for valid asteroid ID."""
        mock_data_access = Mock()
        mock_data_access.get_asteroid_spectrum.return_value = {
            'asteroid_id': 1,
            'wavelengths': [0.45, 1.0, 2.45],
            'reflectances': [0.95, 1.0, 1.08],
            'normalized': True,
            'metadata': {}
        }
        mock_get_data_access.return_value = mock_data_access

        response = client.get('/api/asteroids/1/spectrum')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'spectrum' in data
        assert data['spectrum']['asteroid_id'] == 1
    
    @patch('app.api.spectral.get_data_access')
    def test_get_asteroid_spectrum_with_parameters(self, mock_get_data_access, client):
        """Test getting spectrum with optional parameters."""
        mock_data_access = Mock()
        mock_data_access.get_asteroid_spectrum.return_value = {
            'asteroid_id': 1,
            'wavelengths': [0.4, 0.6, 1.2, 2.2],
            'reflectances': [0.8, 0.9, 1.0, 1.1],
            'normalized': True,
            'metadata': {}
        }
        mock_get_data_access.return_value = mock_data_access

        response = client.get('/api/asteroids/1/spectrum?normalized=false&wavelength_range=0.5-2.0')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['spectrum']['wavelength_range']['min'] == 0.5
        assert data['spectrum']['wavelength_range']['max'] == 2.0
        assert all(0.5 <= wl <= 2.0 for wl in data['spectrum']['wavelengths'])
    
    def test_spectra_batch_valid_request(self, client):
        """Test batch spectra request."""
        request_data = {'asteroid_ids': [1, 2]}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['spectra']) == 2

class TestExportAPI:
    """Test export API endpoints."""
    
    @patch('app.api.export.get_export_service')
    def test_data_export_valid_request(self, mock_get_export_service, client):
        """Test data export with valid request."""
        mock_export_service = Mock()
        mock_export_service.export_data.return_value = ExportResult(
            content=b"id,name\n1,Ceres\n",
            filename="asteroids_export.csv",
            mime_type="text/csv",
            size_bytes=16,
            item_count=3,
            format="csv"
        )
        mock_get_export_service.return_value = mock_export_service

        request_data = {
            'item_ids': ['ast_1', 'ast_2', 'ast_3'],
            'format': 'csv'
        }
        response = client.post('/api/export/asteroids',
                             data=json.dumps(request_data),
                             content_type='application/json')
        assert response.status_code == 200
        assert 'asteroids_export.csv' in response.headers['Content-Disposition']
    
    @patch('app.api.export.get_export_service')
    def test_spectrum_export_valid_request(self, mock_get_export_service, client):
        """Test spectrum export with valid request."""
        mock_export_service = Mock()
        mock_export_service.export_data.return_value = ExportResult(
            content=b"{}",
            filename="asteroids_export.json",
            mime_type="application/json",
            size_bytes=2,
            item_count=2,
            format="json"
        )
        mock_get_export_service.return_value = mock_export_service

        request_data = {
            'item_ids': ['ast_1', 'ast_2'],
            'format': 'json',
            'include_fields': {'spectral_data': True}
        }
        response = client.post('/api/export/asteroids',
                             data=json.dumps(request_data),
                             content_type='application/json')
        assert response.status_code == 200
        assert 'asteroids_export.json' in response.headers['Content-Disposition']
