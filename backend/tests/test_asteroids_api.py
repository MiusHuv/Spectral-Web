"""
Unit tests for asteroid data API endpoints.
"""
import pytest
import json
from unittest.mock import Mock, patch
from app import create_app
from app.services.data_access import DataAccessLayer


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
    with patch('app.api.asteroids.get_data_access') as mock:
        yield mock.return_value


class TestAsteroidDetail:
    """Test cases for asteroid detail endpoint."""
    
    def test_get_asteroid_success(self, client, mock_data_access):
        """Test successful asteroid retrieval."""
        # Mock data
        asteroid_data = {
            'id': 1,
            'identifiers': {
                'official_number': 1,
                'proper_name': 'Ceres',
                'provisional_designation': None
            },
            'classifications': {
                'bus_demeo_class': 'C',
                'tholen_class': 'G',
                'orbital_class': 'MBA'
            },
            'orbital_elements': {
                'semi_major_axis': 2.77,
                'eccentricity': 0.076,
                'inclination': 10.6,
                'orbital_period': 1681.0
            },
            'physical_properties': {
                'diameter': 939.4,
                'albedo': 0.09,
                'rotation_period': 9.074,
                'density': 2.16
            }
        }
        
        mock_data_access.get_asteroid_details.return_value = asteroid_data
        
        # Make request
        response = client.get('/api/asteroids/1')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['asteroid'] == asteroid_data
        mock_data_access.get_asteroid_details.assert_called_once_with(1)
    
    def test_get_asteroid_not_found(self, client, mock_data_access):
        """Test asteroid not found."""
        mock_data_access.get_asteroid_details.return_value = None
        
        response = client.get('/api/asteroids/999999')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'not found' in data['message'].lower()
    
    def test_get_asteroid_invalid_id_non_numeric(self, client):
        """Test invalid asteroid ID (non-numeric)."""
        response = client.get('/api/asteroids/abc')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid asteroid id' in data['error'].lower()
    
    def test_get_asteroid_invalid_id_negative(self, client):
        """Test invalid asteroid ID (negative)."""
        response = client.get('/api/asteroids/-1')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive' in data['message'].lower()
    
    def test_get_asteroid_invalid_id_zero(self, client):
        """Test invalid asteroid ID (zero)."""
        response = client.get('/api/asteroids/0')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive' in data['message'].lower()
    
    def test_get_asteroid_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_asteroid_details.side_effect = Exception("Database connection failed")
        
        response = client.get('/api/asteroids/1')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to fetch' in data['error'].lower()


class TestAsteroidBatch:
    """Test cases for asteroid batch endpoint."""
    
    def test_post_asteroids_batch_success(self, client, mock_data_access):
        """Test successful batch asteroid retrieval."""
        # Mock data
        asteroids_data = [
            {
                'id': 1,
                'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
                'classifications': {'bus_demeo_class': 'C'},
                'orbital_elements': {'semi_major_axis': 2.77},
                'physical_properties': {'diameter': 939.4}
            },
            {
                'id': 2,
                'identifiers': {'official_number': 2, 'proper_name': 'Pallas'},
                'classifications': {'bus_demeo_class': 'B'},
                'orbital_elements': {'semi_major_axis': 2.77},
                'physical_properties': {'diameter': 512.0}
            }
        ]
        
        mock_data_access.get_asteroids_batch.return_value = asteroids_data
        
        # Make request
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': [1, 2]},
                             content_type='application/json')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['asteroids'] == asteroids_data
        assert data['requested_count'] == 2
        assert data['returned_count'] == 2
        mock_data_access.get_asteroids_batch.assert_called_once_with([1, 2])
    
    def test_post_asteroids_batch_empty_list(self, client):
        """Test batch request with empty asteroid list."""
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': []},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'empty' in data['error'].lower()
    
    def test_post_asteroids_batch_too_many_ids(self, client):
        """Test batch request with too many asteroid IDs."""
        asteroid_ids = list(range(1, 102))  # 101 IDs
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': asteroid_ids},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'too many' in data['error'].lower()
    
    def test_post_asteroids_batch_invalid_json(self, client):
        """Test batch request with invalid JSON."""
        response = client.post('/api/asteroids/batch', 
                             data='invalid json',
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid request format' in data['error'].lower()
    
    def test_post_asteroids_batch_missing_field(self, client):
        """Test batch request with missing asteroid_ids field."""
        response = client.post('/api/asteroids/batch', 
                             json={'other_field': 'value'},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'missing required field' in data['error'].lower()
    
    def test_post_asteroids_batch_invalid_ids_format(self, client):
        """Test batch request with invalid asteroid_ids format."""
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': 'not_a_list'},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'must be an array' in data['message'].lower()
    
    def test_post_asteroids_batch_invalid_id_values(self, client):
        """Test batch request with invalid asteroid ID values."""
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': [1, 'abc', 3]},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive integers' in data['message'].lower()
    
    def test_post_asteroids_batch_negative_ids(self, client):
        """Test batch request with negative asteroid IDs."""
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': [1, -2, 3]},
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'positive integers' in data['message'].lower()
    
    def test_post_asteroids_batch_database_error(self, client, mock_data_access):
        """Test batch request with database error."""
        mock_data_access.get_asteroids_batch.side_effect = Exception("Database error")
        
        response = client.post('/api/asteroids/batch', 
                             json={'asteroid_ids': [1, 2]},
                             content_type='application/json')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to fetch' in data['error'].lower()


class TestAsteroidSearch:
    """Test cases for asteroid search endpoint."""
    
    def test_search_asteroids_success(self, client, mock_data_access):
        """Test successful asteroid search."""
        # Mock data
        search_results = [
            {
                'id': 1,
                'display_name': 'Ceres',
                'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
                'classifications': {'bus_demeo_class': 'C', 'tholen_class': 'G'},
                'has_spectral_data': True
            },
            {
                'id': 2,
                'display_name': 'Pallas',
                'identifiers': {'official_number': 2, 'proper_name': 'Pallas'},
                'classifications': {'bus_demeo_class': 'B', 'tholen_class': 'B'},
                'has_spectral_data': True
            }
        ]
        
        mock_data_access.search_asteroids.return_value = search_results
        
        # Make request
        response = client.get('/api/asteroids/search?q=Ceres&limit=10')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['query'] == 'Ceres'
        assert data['results'] == search_results
        assert data['count'] == 2
        assert data['limit'] == 10
        mock_data_access.search_asteroids.assert_called_once_with('Ceres', 10)
    
    def test_search_asteroids_empty_query(self, client):
        """Test search with empty query."""
        response = client.get('/api/asteroids/search?q=')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'missing search query' in data['error'].lower()
    
    def test_search_asteroids_no_query_param(self, client):
        """Test search without query parameter."""
        response = client.get('/api/asteroids/search')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'missing search query' in data['error'].lower()
    
    def test_search_asteroids_query_too_short(self, client):
        """Test search with query too short."""
        response = client.get('/api/asteroids/search?q=a')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'query too short' in data['error'].lower()
    
    def test_search_asteroids_invalid_limit(self, client):
        """Test search with invalid limit parameter."""
        response = client.get('/api/asteroids/search?q=Ceres&limit=200')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
    
    def test_search_asteroids_negative_limit(self, client):
        """Test search with negative limit."""
        response = client.get('/api/asteroids/search?q=Ceres&limit=-1')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
    
    def test_search_asteroids_default_limit(self, client, mock_data_access):
        """Test search with default limit."""
        mock_data_access.search_asteroids.return_value = []
        
        response = client.get('/api/asteroids/search?q=test')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['limit'] == 50  # Default limit
        mock_data_access.search_asteroids.assert_called_once_with('test', 50)
    
    def test_search_asteroids_database_error(self, client, mock_data_access):
        """Test search with database error."""
        mock_data_access.search_asteroids.side_effect = Exception("Database error")
        
        response = client.get('/api/asteroids/search?q=Ceres')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to search' in data['error'].lower()
    
    def test_search_asteroids_no_results(self, client, mock_data_access):
        """Test search with no results."""
        mock_data_access.search_asteroids.return_value = []
        
        response = client.get('/api/asteroids/search?q=nonexistent')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['results'] == []
        assert data['count'] == 0


class TestAsteroidAPIIntegration:
    """Integration tests for asteroid API endpoints."""
    
    def test_asteroid_detail_to_batch_consistency(self, client, mock_data_access):
        """Test that detail and batch endpoints return consistent data."""
        # Mock data for single asteroid
        asteroid_data = {
            'id': 1,
            'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
            'classifications': {'bus_demeo_class': 'C'},
            'orbital_elements': {'semi_major_axis': 2.77},
            'physical_properties': {'diameter': 939.4}
        }
        
        mock_data_access.get_asteroid_details.return_value = asteroid_data
        mock_data_access.get_asteroids_batch.return_value = [asteroid_data]
        
        # Get single asteroid
        detail_response = client.get('/api/asteroids/1')
        detail_data = json.loads(detail_response.data)
        
        # Get same asteroid in batch
        batch_response = client.post('/api/asteroids/batch', 
                                   json={'asteroid_ids': [1]},
                                   content_type='application/json')
        batch_data = json.loads(batch_response.data)
        
        # Compare data
        assert detail_data['asteroid'] == batch_data['asteroids'][0]
    
    def test_search_to_detail_workflow(self, client, mock_data_access):
        """Test workflow from search to detail retrieval."""
        # Mock search results
        search_results = [
            {
                'id': 1,
                'display_name': 'Ceres',
                'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
                'classifications': {'bus_demeo_class': 'C'},
                'has_spectral_data': True
            }
        ]
        
        # Mock detail data
        detail_data = {
            'id': 1,
            'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
            'classifications': {'bus_demeo_class': 'C'},
            'orbital_elements': {'semi_major_axis': 2.77},
            'physical_properties': {'diameter': 939.4}
        }
        
        mock_data_access.search_asteroids.return_value = search_results
        mock_data_access.get_asteroid_details.return_value = detail_data
        
        # Search for asteroid
        search_response = client.get('/api/asteroids/search?q=Ceres')
        search_data = json.loads(search_response.data)
        
        # Get first result ID
        asteroid_id = search_data['results'][0]['id']
        
        # Get detailed information
        detail_response = client.get(f'/api/asteroids/{asteroid_id}')
        detail_response_data = json.loads(detail_response.data)
        
        # Verify consistency
        assert asteroid_id == detail_response_data['asteroid']['id']
        assert search_data['results'][0]['identifiers'] == detail_response_data['asteroid']['identifiers']