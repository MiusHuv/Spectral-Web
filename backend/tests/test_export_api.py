"""
Unit tests for export API endpoints.
"""
import pytest
import json
import io
from unittest.mock import Mock, patch, MagicMock
from flask import Flask
from app.api.export import export_bp
from app.services.data_access import DataAccessService

@pytest.fixture
def app():
    """Create test Flask application."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(export_bp, url_prefix='/api')
    return app

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

@pytest.fixture
def mock_data_service():
    """Create mock data access service."""
    return Mock(spec=DataAccessService)

@pytest.fixture
def sample_asteroid_data():
    """Sample asteroid data for testing."""
    return {
        'id': 1,
        'official_number': 1,
        'proper_name': 'Ceres',
        'provisional_designation': None,
        'bus_demeo_class': 'C',
        'tholen_class': 'G',
        'orbital_class': 'MBA',
        'semi_major_axis': 2.77,
        'eccentricity': 0.076,
        'inclination': 10.6,
        'orbital_period': 1681.6,
        'perihelion_distance': 2.56,
        'aphelion_distance': 2.98,
        'diameter': 939.4,
        'albedo': 0.09,
        'rotation_period': 9.07,
        'density': 2.16
    }

@pytest.fixture
def sample_spectral_data():
    """Sample spectral data for testing."""
    return {
        'asteroid_id': 1,
        'wavelengths': [0.45, 0.50, 0.55, 0.60],
        'reflectances': [0.8, 0.85, 0.9, 0.88],
        'normalized': True
    }

class TestExportDataEndpoint:
    """Test cases for /api/export/data endpoint."""
    
    def test_export_data_csv_success(self, client, mock_data_service, sample_asteroid_data):
        """Test successful CSV data export."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_asteroid_by_id.return_value = sample_asteroid_data
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'csv'
                                 })
            
            assert response.status_code == 200
            assert response.headers['Content-Type'] == 'text/csv; charset=utf-8'
            assert 'asteroid_data_' in response.headers['Content-Disposition']
            
            # Check CSV content
            content = response.data.decode('utf-8')
            assert 'id,official_number,proper_name' in content
            assert '1,1,Ceres' in content
    
    def test_export_data_json_success(self, client, mock_data_service, sample_asteroid_data):
        """Test successful JSON data export."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_asteroid_by_id.return_value = sample_asteroid_data
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'json'
                                 })
            
            assert response.status_code == 200
            assert 'application/json' in response.headers['Content-Type']
            assert 'asteroid_data_' in response.headers['Content-Disposition']
    
    def test_export_data_with_spectral(self, client, mock_data_service, sample_asteroid_data, sample_spectral_data):
        """Test data export with spectral data included."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_asteroid_by_id.return_value = sample_asteroid_data
            mock_data_service.get_spectral_data.return_value = sample_spectral_data
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'json',
                                     'include_spectral': True
                                 })
            
            assert response.status_code == 200
            mock_data_service.get_spectral_data.assert_called_once_with(1)
    
    def test_export_data_missing_asteroid_ids(self, client):
        """Test export with missing asteroid_ids."""
        response = client.post('/api/export/data', json={'format': 'csv'})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'asteroid_ids is required' in data['message']
    
    def test_export_data_empty_asteroid_ids(self, client):
        """Test export with empty asteroid_ids list."""
        response = client.post('/api/export/data', 
                             json={
                                 'asteroid_ids': [],
                                 'format': 'csv'
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'At least one asteroid_id is required' in data['message']
    
    def test_export_data_invalid_format(self, client):
        """Test export with invalid format."""
        response = client.post('/api/export/data', 
                             json={
                                 'asteroid_ids': [1],
                                 'format': 'xml'
                             })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Format must be either "csv" or "json"' in data['message']
    
    def test_export_data_no_valid_data(self, client, mock_data_service):
        """Test export when no valid asteroid data is found."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_asteroid_by_id.return_value = None
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [999],
                                     'format': 'csv'
                                 })
            
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'No valid asteroid data found' in data['message']

class TestExportSpectrumEndpoint:
    """Test cases for /api/export/spectrum endpoint."""
    
    def test_export_spectrum_json_success(self, client, mock_data_service, sample_spectral_data):
        """Test successful JSON spectral export."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_spectral_data.return_value = sample_spectral_data
            
            response = client.post('/api/export/spectrum', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'json'
                                 })
            
            assert response.status_code == 200
            assert 'application/json' in response.headers['Content-Type']
            assert 'spectral_data_' in response.headers['Content-Disposition']
    
    def test_export_spectrum_csv_format_helper(self, app):
        """Test CSV spectral export formatting helper function."""
        from app.api.export import _export_spectral_csv
        
        test_data = [{
            'asteroid_id': 1,
            'wavelengths': [0.45, 0.50],
            'reflectances': [0.8, 0.85],
            'normalized': True
        }]
        test_metadata = {
            'export_timestamp': '2023-01-01T00:00:00Z',
            'total_spectra': 1,
            'include_raw': False,
            'data_source': 'test'
        }
        
        with app.test_request_context():
            response = _export_spectral_csv(test_data, test_metadata, False)
            
            assert response.status_code == 200
            assert 'text/csv' in response.headers['Content-Type']
    
    def test_export_spectrum_with_raw_data(self, client, mock_data_service, sample_spectral_data):
        """Test spectral export with raw data included."""
        raw_data = {
            'asteroid_id': 1,
            'wavelengths': [0.44, 0.49, 0.54, 0.59],
            'reflectances': [0.78, 0.83, 0.88, 0.86],
            'normalized': False
        }
        
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_spectral_data.return_value = sample_spectral_data
            mock_data_service.get_raw_spectral_data.return_value = raw_data
            
            response = client.post('/api/export/spectrum', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'csv',
                                     'include_raw': True
                                 })
            
            assert response.status_code == 200
            mock_data_service.get_raw_spectral_data.assert_called_once_with(1)
            
            # Check that both processed and raw data are in CSV
            content = response.data.decode('utf-8')
            assert 'data_type' in content
            assert 'processed' in content
            assert 'raw' in content
    
    def test_export_spectrum_missing_asteroid_ids(self, client):
        """Test spectrum export with missing asteroid_ids."""
        response = client.post('/api/export/spectrum', json={'format': 'json'})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'asteroid_ids is required' in data['message']
    
    def test_export_spectrum_no_spectral_data(self, client, mock_data_service):
        """Test spectrum export when no spectral data is found."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_spectral_data.return_value = None
            
            response = client.post('/api/export/spectrum', 
                                 json={
                                     'asteroid_ids': [999],
                                     'format': 'json'
                                 })
            
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'No spectral data found' in data['message']

class TestExportHelperFunctions:
    """Test cases for export helper functions."""
    
    def test_export_json_format(self, app):
        """Test JSON export formatting."""
        from app.api.export import _export_json
        
        test_data = [{'id': 1, 'name': 'Test'}]
        test_metadata = {'export_timestamp': '2023-01-01T00:00:00Z'}
        
        with app.test_request_context():
            response = _export_json(test_data, test_metadata)
            
            assert response.status_code == 200
            assert 'application/json' in response.headers['Content-Type']
    
    def test_export_csv_format(self, app):
        """Test CSV export formatting."""
        from app.api.export import _export_csv
        
        test_data = [{'id': 1, 'official_number': 1, 'proper_name': 'Test'}]
        test_metadata = {'export_timestamp': '2023-01-01T00:00:00Z', 'include_spectral': False, 'total_asteroids': 1, 'data_source': 'test'}
        
        with app.test_request_context():
            response = _export_csv(test_data, test_metadata, False)
            
            assert response.status_code == 200
            assert 'text/csv' in response.headers['Content-Type']

class TestExportErrorHandling:
    """Test cases for export error handling and edge cases."""
    
    def test_export_data_service_error(self, client, mock_data_service):
        """Test handling of data service errors."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_asteroid_by_id.side_effect = Exception("Database error")
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'csv'
                                 })
            
            # The current implementation returns 404 when no valid data is found
            # even if there are service errors, because it catches exceptions and continues
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'No valid asteroid data found' in data['message']
    
    def test_export_spectrum_service_error(self, client, mock_data_service):
        """Test handling of spectral service errors."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            mock_data_service.get_spectral_data.side_effect = Exception("Spectral error")
            
            response = client.post('/api/export/spectrum', 
                                 json={
                                     'asteroid_ids': [1],
                                     'format': 'json'
                                 })
            
            # The current implementation returns 404 when no spectral data is found
            # even if there are service errors, because it catches exceptions and continues
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'No spectral data found' in data['message']
    
    def test_export_partial_data_success(self, client, mock_data_service, sample_asteroid_data):
        """Test export when some asteroids have data and others don't."""
        with patch('app.api.export.get_database_service') as mock_db_service, \
             patch('app.api.export.DataAccessService') as mock_service_class:
            
            mock_service_class.return_value = mock_data_service
            
            def mock_get_asteroid(asteroid_id):
                if asteroid_id == 1:
                    return sample_asteroid_data
                return None
            
            mock_data_service.get_asteroid_by_id.side_effect = mock_get_asteroid
            
            response = client.post('/api/export/data', 
                                 json={
                                     'asteroid_ids': [1, 999],
                                     'format': 'csv'
                                 })
            
            assert response.status_code == 200
            # Should export the one valid asteroid
            content = response.data.decode('utf-8')
            assert '1,1,Ceres' in content