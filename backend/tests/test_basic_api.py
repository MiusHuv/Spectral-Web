"""
Basic API tests without database dependencies.
"""
import pytest
import json
from unittest.mock import Mock, patch
import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
clustering_pipeline_path = os.path.join(project_root, 'clustering_pipeline')
if clustering_pipeline_path not in sys.path:
    sys.path.insert(0, clustering_pipeline_path)

from app import create_app


@pytest.fixture
def app():
    """Create test Flask application."""
    with patch('app.services.database_service.DatabaseManager'), \
         patch('app.services.database_service.SpectralDataLoader'):
        app = create_app('testing')
        return app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


class TestBasicAPI:
    """Test basic API functionality."""
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert data['service'] == 'asteroid-spectral-api'
    
    def test_asteroid_detail_validation(self, client):
        """Test asteroid detail endpoint validation."""
        # Test invalid ID
        response = client.get('/api/asteroids/abc')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'valid integer' in data['message'].lower()
    
    def test_asteroid_batch_validation(self, client):
        """Test asteroid batch endpoint validation."""
        # Test invalid JSON
        response = client.post('/api/asteroids/batch', 
                             data='invalid json',
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'valid json' in data['message'].lower()
    
    def test_classification_system_validation(self, client):
        """Test classification system validation."""
        # Test invalid system
        response = client.get('/api/classifications/invalid_system/asteroids')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid classification system' in data['error'].lower()
    
    def test_search_validation(self, client):
        """Test search endpoint validation."""
        # Test missing query
        response = client.get('/api/asteroids/search')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'search query is required' in data['message'].lower()
    
    def test_404_handling(self, client):
        """Test 404 error handling."""
        response = client.get('/api/nonexistent')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        # The Flask-RESTful 404 response has a different structure
        assert 'message' in data
        assert 'not found' in data['message'].lower() or 'does not exist' in data['message'].lower()


class TestAPIEndpointStructure:
    """Test API endpoint structure and response format."""
    
    @patch('app.api.asteroids.get_data_access')
    def test_asteroid_detail_response_structure(self, mock_get_data_access, client):
        """Test asteroid detail response structure."""
        # Mock successful response
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
        
        # Check response structure
        assert 'asteroid' in data
        assert 'status' in data
        assert data['status'] == 'success'
        
        # Check asteroid structure
        asteroid = data['asteroid']
        assert 'id' in asteroid
        assert 'identifiers' in asteroid
        assert 'classifications' in asteroid
        assert 'orbital_elements' in asteroid
        assert 'physical_properties' in asteroid
    
    @patch('app.api.asteroids.get_data_access')
    def test_asteroid_batch_response_structure(self, mock_get_data_access, client):
        """Test asteroid batch response structure."""
        # Mock successful response
        mock_data_access = Mock()
        mock_data_access.get_asteroids_batch.return_value = [
            {
                'id': 1,
                'identifiers': {'official_number': 1},
                'classifications': {'bus_demeo_class': 'C'},
                'orbital_elements': {},
                'physical_properties': {}
            }
        ]
        mock_get_data_access.return_value = mock_data_access
        
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': [1]},
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Check response structure
        assert 'asteroids' in data
        assert 'requested_count' in data
        assert 'returned_count' in data
        assert 'status' in data
        assert data['status'] == 'success'
        assert data['requested_count'] == 1
        assert data['returned_count'] == 1
    
    @patch('app.api.classifications.get_data_access')
    def test_classification_systems_response_structure(self, mock_get_data_access, client):
        """Test classification systems response structure."""
        # Mock successful response
        mock_data_access = Mock()
        mock_data_access.get_classification_systems.return_value = {
            'systems': [
                {
                    'name': 'bus_demeo',
                    'display_name': 'Bus-DeMeo',
                    'classes': ['A', 'B', 'C']
                }
            ]
        }
        mock_get_data_access.return_value = mock_data_access
        
        response = client.get('/api/classifications')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Check response structure
        assert 'systems' in data
        assert 'status' in data
        assert data['status'] == 'success'
        
        # Check systems structure
        systems = data['systems']
        assert len(systems) > 0
        system = systems[0]
        assert 'name' in system
        assert 'display_name' in system
        assert 'classes' in system
    
    @patch('app.api.classifications.get_data_access')
    def test_classification_asteroids_response_structure(self, mock_get_data_access, client):
        """Test classification asteroids response structure."""
        # Mock successful response
        mock_data_access = Mock()
        mock_data_access.get_asteroids_by_classification.return_value = {
            'classes': [
                {
                    'name': 'C',
                    'count': 1,
                    'asteroids': [
                        {
                            'id': 1,
                            'display_name': 'Ceres',
                            'identifiers': {'official_number': 1},
                            'has_spectral_data': True
                        }
                    ]
                }
            ]
        }
        mock_get_data_access.return_value = mock_data_access
        
        response = client.get('/api/classifications/bus_demeo/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Check response structure
        assert 'system' in data
        assert 'classes' in data
        assert 'pagination' in data
        assert 'status' in data
        assert data['status'] == 'success'
        assert data['system'] == 'bus_demeo'
        
        # Check pagination structure
        pagination = data['pagination']
        assert 'limit' in pagination
        assert 'offset' in pagination
        assert 'total' in pagination
        
        # Check classes structure
        classes = data['classes']
        assert len(classes) > 0
        class_data = classes[0]
        assert 'name' in class_data
        assert 'count' in class_data
        assert 'asteroids' in class_data
    
    @patch('app.api.asteroids.get_data_access')
    def test_search_response_structure(self, mock_get_data_access, client):
        """Test search response structure."""
        # Mock successful response
        mock_data_access = Mock()
        mock_data_access.search_asteroids.return_value = [
            {
                'id': 1,
                'display_name': 'Ceres',
                'identifiers': {'official_number': 1},
                'classifications': {'bus_demeo_class': 'C'},
                'has_spectral_data': True
            }
        ]
        mock_get_data_access.return_value = mock_data_access
        
        response = client.get('/api/asteroids/search?q=Ceres')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Check response structure
        assert 'query' in data
        assert 'results' in data
        assert 'count' in data
        assert 'limit' in data
        assert 'status' in data
        assert data['status'] == 'success'
        assert data['query'] == 'Ceres'
        assert data['count'] == 1
        
        # Check results structure
        results = data['results']
        assert len(results) > 0
        result = results[0]
        assert 'id' in result
        assert 'display_name' in result
        assert 'identifiers' in result
        assert 'classifications' in result
        assert 'has_spectral_data' in result
