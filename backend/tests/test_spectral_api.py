"""
Unit tests for spectral data API endpoints.
Tests individual and batch spectral data retrieval, caching, and error handling.
"""
import pytest
import json
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from flask import Flask
from app import create_app
from app.services.data_access import get_data_access


@pytest.fixture
def app():
    """Create test Flask application."""
    app = create_app('testing')
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def mock_data_access():
    """Mock data access layer."""
    with patch('app.api.spectral.get_data_access') as mock:
        yield mock.return_value


@pytest.fixture
def sample_spectrum_data():
    """Sample spectral data for testing."""
    wavelengths = np.arange(0.45, 2.45, 0.005).tolist()
    reflectances = np.random.random(len(wavelengths)).tolist()
    
    return {
        'asteroid_id': 1,
        'wavelengths': wavelengths,
        'reflectances': reflectances,
        'normalized': True,
        'wavelength_range': {
            'min': 0.45,
            'max': 2.45
        },
        'metadata': {
            'observation_id': 123,
            'observation_date': '2023-01-01',
            'data_source': 'test_source'
        }
    }


@pytest.fixture
def sample_batch_spectra():
    """Sample batch spectral data for testing."""
    spectra = []
    for i in range(1, 4):
        wavelengths = np.arange(0.45, 2.45, 0.005).tolist()
        reflectances = np.random.random(len(wavelengths)).tolist()
        
        spectra.append({
            'asteroid_id': i,
            'wavelengths': wavelengths,
            'reflectances': reflectances,
            'normalized': True,
            'has_data': True,
            'metadata': {
                'observation_id': 100 + i,
                'observation_date': '2023-01-01',
                'data_source': 'test_source'
            }
        })
    
    return spectra


class TestAsteroidSpectrum:
    """Test individual asteroid spectrum endpoint."""
    
    def test_get_spectrum_success(self, client, mock_data_access, sample_spectrum_data):
        """Test successful spectrum retrieval."""
        mock_data_access.get_asteroid_spectrum.return_value = sample_spectrum_data
        
        response = client.get('/api/asteroids/1/spectrum')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'spectrum' in data
        assert data['spectrum']['asteroid_id'] == 1
        assert len(data['spectrum']['wavelengths']) > 0
        assert len(data['spectrum']['reflectances']) > 0
        
        mock_data_access.get_asteroid_spectrum.assert_called_once_with(1)
    
    def test_get_spectrum_not_found(self, client, mock_data_access):
        """Test spectrum not found."""
        mock_data_access.get_asteroid_spectrum.return_value = None
        
        response = client.get('/api/asteroids/999/spectrum')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'no spectral data available' in data['message'].lower()
    
    def test_get_spectrum_invalid_id(self, client):
        """Test invalid asteroid ID."""
        response = client.get('/api/asteroids/invalid/spectrum')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'asteroid id must be' in data['message'].lower()
    
    def test_get_spectrum_negative_id(self, client):
        """Test negative asteroid ID."""
        response = client.get('/api/asteroids/-1/spectrum')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive' in data['message'].lower()
    
    def test_get_spectrum_with_wavelength_range(self, client, mock_data_access, sample_spectrum_data):
        """Test spectrum retrieval with custom wavelength range."""
        mock_data_access.get_asteroid_spectrum.return_value = sample_spectrum_data
        
        response = client.get('/api/asteroids/1/spectrum?wavelength_range=0.5-1.5')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        
        # Check that wavelengths are filtered
        wavelengths = data['spectrum']['wavelengths']
        assert all(0.5 <= wl <= 1.5 for wl in wavelengths)
    
    def test_get_spectrum_invalid_wavelength_range(self, client):
        """Test invalid wavelength range format."""
        response = client.get('/api/asteroids/1/spectrum?wavelength_range=invalid')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'wavelength range' in data['message'].lower()
    
    def test_get_spectrum_normalized_parameter(self, client, mock_data_access, sample_spectrum_data):
        """Test normalized parameter."""
        mock_data_access.get_asteroid_spectrum.return_value = sample_spectrum_data
        
        response = client.get('/api/asteroids/1/spectrum?normalized=false')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
    
    def test_get_spectrum_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_asteroid_spectrum.side_effect = Exception("Database error")
        
        response = client.get('/api/asteroids/1/spectrum')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'database error' in data['message'].lower()


class TestSpectraBatch:
    """Test batch spectra endpoint."""
    
    def test_batch_spectra_success(self, client, mock_data_access, sample_batch_spectra):
        """Test successful batch spectra retrieval."""
        mock_data_access.get_asteroids_spectra_batch.return_value = sample_batch_spectra
        
        request_data = {'asteroid_ids': [1, 2, 3]}
        response = client.post('/api/spectra/batch', 
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['requested_count'] == 3
        assert data['returned_count'] == 3
        assert len(data['spectra']) == 3
        
        mock_data_access.get_asteroids_spectra_batch.assert_called_once_with([1, 2, 3])
    
    def test_batch_spectra_empty_request(self, client):
        """Test empty asteroid_ids array."""
        request_data = {'asteroid_ids': []}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'at least one' in data['message'].lower()
    
    def test_batch_spectra_too_many_ids(self, client):
        """Test too many asteroid IDs."""
        request_data = {'asteroid_ids': list(range(1, 52))}  # 51 IDs
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'maximum 50' in data['message'].lower()
    
    def test_batch_spectra_invalid_json(self, client):
        """Test invalid JSON request."""
        response = client.post('/api/spectra/batch',
                             data='invalid json',
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'json' in data['message'].lower()
    
    def test_batch_spectra_missing_field(self, client):
        """Test missing asteroid_ids field."""
        request_data = {'other_field': 'value'}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'asteroid_ids' in data['message'].lower()
    
    def test_batch_spectra_invalid_id_format(self, client):
        """Test invalid asteroid ID format."""
        request_data = {'asteroid_ids': [1, 'invalid', 3]}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive integer' in data['message'].lower()
    
    def test_batch_spectra_with_parameters(self, client, mock_data_access, sample_batch_spectra):
        """Test batch spectra with optional parameters."""
        mock_data_access.get_asteroids_spectra_batch.return_value = sample_batch_spectra
        
        request_data = {
            'asteroid_ids': [1, 2, 3],
            'normalized': False,
            'wavelength_range': '0.5-1.5'
        }
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['parameters']['normalized'] == False
        assert data['parameters']['wavelength_range'] == '0.5-1.5'
    
    def test_batch_spectra_partial_data(self, client, mock_data_access):
        """Test batch spectra with some asteroids having no data."""
        # Mock data with mixed results
        mixed_spectra = [
            {
                'asteroid_id': 1,
                'wavelengths': np.arange(0.45, 2.45, 0.005).tolist(),
                'reflectances': np.random.random(400).tolist(),
                'has_data': True,
                'metadata': {'observation_id': 101}
            },
            {
                'asteroid_id': 2,
                'wavelengths': [],
                'reflectances': [],
                'has_data': False,
                'metadata': {'error': 'No spectral data available'}
            }
        ]
        mock_data_access.get_asteroids_spectra_batch.return_value = mixed_spectra
        
        request_data = {'asteroid_ids': [1, 2, 3]}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['spectra_with_data'] == 1
        assert len(data['spectra']) == 3  # Should include entry for asteroid 3 with no data
    
    def test_batch_spectra_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_asteroids_spectra_batch.side_effect = Exception("Database error")
        
        request_data = {'asteroid_ids': [1, 2, 3]}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'database error' in data['message'].lower()


class TestWavelengthGrid:
    """Test wavelength grid endpoint."""
    
    def test_get_wavelength_grid_success(self, client, mock_data_access):
        """Test successful wavelength grid retrieval."""
        mock_wavelengths = np.arange(0.45, 2.45, 0.005)
        mock_data_access.get_wavelength_grid.return_value = mock_wavelengths
        
        response = client.get('/api/spectra/wavelength-grid')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'wavelengths' in data
        assert data['count'] == len(mock_wavelengths)
        assert data['resolution'] == 0.005
        assert data['units'] == 'micrometers'
        
        mock_data_access.get_wavelength_grid.assert_called_once()
    
    def test_get_wavelength_grid_with_range(self, client, mock_data_access):
        """Test wavelength grid with custom range."""
        mock_wavelengths = np.arange(0.45, 2.45, 0.005)
        mock_data_access.get_wavelength_grid.return_value = mock_wavelengths
        
        response = client.get('/api/spectra/wavelength-grid?wavelength_range=0.5-1.5')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        
        # Check that wavelengths are filtered
        wavelengths = data['wavelengths']
        assert all(0.5 <= wl <= 1.5 for wl in wavelengths)
        assert data['range']['requested_min'] == 0.5
        assert data['range']['requested_max'] == 1.5
    
    def test_get_wavelength_grid_invalid_range(self, client):
        """Test invalid wavelength range."""
        response = client.get('/api/spectra/wavelength-grid?wavelength_range=invalid')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'wavelength range' in data['message'].lower()
    
    def test_get_wavelength_grid_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_wavelength_grid.side_effect = Exception("Database error")
        
        response = client.get('/api/spectra/wavelength-grid')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'database error' in data['message'].lower()


class TestSpectralCaching:
    """Test caching functionality for spectral endpoints."""
    
    @patch('app.api.spectral.get_cache')
    def test_spectrum_caching(self, mock_get_cache, client, mock_data_access, sample_spectrum_data):
        """Test that spectrum results are cached."""
        mock_cache = Mock()
        mock_get_cache.return_value = mock_cache
        mock_cache.get.return_value = None  # No cached result initially
        
        mock_data_access.get_asteroid_spectrum.return_value = sample_spectrum_data
        
        response = client.get('/api/asteroids/1/spectrum')
        
        assert response.status_code == 200
        mock_cache.set.assert_called_once()
        
        # Verify cache key format
        cache_key = mock_cache.set.call_args[0][0]
        assert 'spectrum_1' in cache_key
    
    @patch('app.api.spectral.get_cache')
    def test_batch_spectra_caching(self, mock_get_cache, client, mock_data_access, sample_batch_spectra):
        """Test that batch spectra results are cached."""
        mock_cache = Mock()
        mock_get_cache.return_value = mock_cache
        mock_cache.get.return_value = None  # No cached result initially
        
        mock_data_access.get_asteroids_spectra_batch.return_value = sample_batch_spectra
        
        request_data = {'asteroid_ids': [1, 2, 3]}
        response = client.post('/api/spectra/batch',
                             data=json.dumps(request_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        mock_cache.set.assert_called_once()
        
        # Verify cache key format
        cache_key = mock_cache.set.call_args[0][0]
        assert 'spectra_batch' in cache_key
    
    @patch('app.api.spectral.get_cache')
    def test_wavelength_grid_caching(self, mock_get_cache, client, mock_data_access):
        """Test that wavelength grid results are cached."""
        mock_cache = Mock()
        mock_get_cache.return_value = mock_cache
        mock_cache.get.return_value = None  # No cached result initially
        
        mock_wavelengths = np.arange(0.45, 2.45, 0.005)
        mock_data_access.get_wavelength_grid.return_value = mock_wavelengths
        
        response = client.get('/api/spectra/wavelength-grid')
        
        assert response.status_code == 200
        mock_cache.set.assert_called_once()
        
        # Verify cache key format and longer timeout for wavelength grid
        cache_key = mock_cache.set.call_args[0][0]
        timeout = mock_cache.set.call_args[1]['timeout']
        assert 'wavelength_grid' in cache_key
        assert timeout == 3600  # 1 hour for wavelength grid
    
    @patch('app.api.spectral.get_cache')
    def test_cache_hit(self, mock_get_cache, client, mock_data_access):
        """Test cache hit scenario."""
        mock_cache = Mock()
        mock_get_cache.return_value = mock_cache
        
        cached_result = {
            'spectrum': {'asteroid_id': 1, 'wavelengths': [], 'reflectances': []},
            'status': 'success'
        }
        mock_cache.get.return_value = cached_result
        
        response = client.get('/api/asteroids/1/spectrum')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data == cached_result
        
        # Should not call data access layer when cache hits
        mock_data_access.get_asteroid_spectrum.assert_not_called()
        mock_cache.set.assert_not_called()


if __name__ == '__main__':
    pytest.main([__file__])