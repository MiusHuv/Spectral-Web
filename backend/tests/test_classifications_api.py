"""
Unit tests for classifications API endpoints.
"""
import pytest
import json
from unittest.mock import Mock, patch
from app import create_app


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
    with patch('app.api.classifications.get_data_access') as mock:
        yield mock.return_value


class TestClassificationSystems:
    """Test cases for classification systems endpoint."""
    
    def test_get_classification_systems_success(self, client, mock_data_access):
        """Test successful retrieval of classification systems."""
        # Mock data
        systems_data = {
            'systems': [
                {
                    'name': 'bus_demeo',
                    'display_name': 'Bus-DeMeo',
                    'classes': ['A', 'B', 'C', 'D', 'K', 'L', 'Q', 'S', 'V', 'X']
                },
                {
                    'name': 'tholen',
                    'display_name': 'Tholen',
                    'classes': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M', 'P', 'Q', 'R', 'S', 'T', 'V']
                }
            ]
        }
        
        mock_data_access.get_classification_systems.return_value = systems_data
        
        # Make request
        response = client.get('/api/classifications')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['systems'] == systems_data['systems']
        assert len(data['systems']) == 2
        
        # Verify system names
        system_names = [system['name'] for system in data['systems']]
        assert 'bus_demeo' in system_names
        assert 'tholen' in system_names
        
        mock_data_access.get_classification_systems.assert_called_once()
    
    def test_get_classification_systems_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_classification_systems.side_effect = Exception("Database connection failed")
        
        response = client.get('/api/classifications')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to fetch' in data['error'].lower()
    
    def test_get_classification_systems_empty_result(self, client, mock_data_access):
        """Test handling of empty classification systems."""
        mock_data_access.get_classification_systems.return_value = {'systems': []}
        
        response = client.get('/api/classifications')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['systems'] == []


class TestClassificationAsteroids:
    """Test cases for classification asteroids endpoint."""
    
    def test_get_classification_asteroids_bus_demeo_success(self, client, mock_data_access):
        """Test successful retrieval of Bus-DeMeo classification asteroids."""
        # Mock data
        classification_data = {
            'classes': [
                {
                    'name': 'C',
                    'count': 3,
                    'asteroids': [
                        {
                            'id': 1,
                            'display_name': 'Ceres',
                            'identifiers': {
                                'official_number': 1,
                                'proper_name': 'Ceres',
                                'provisional_designation': None
                            },
                            'has_spectral_data': True
                        },
                        {
                            'id': 10,
                            'display_name': 'Hygiea',
                            'identifiers': {
                                'official_number': 10,
                                'proper_name': 'Hygiea',
                                'provisional_designation': None
                            },
                            'has_spectral_data': True
                        }
                    ]
                },
                {
                    'name': 'S',
                    'count': 2,
                    'asteroids': [
                        {
                            'id': 3,
                            'display_name': 'Juno',
                            'identifiers': {
                                'official_number': 3,
                                'proper_name': 'Juno',
                                'provisional_designation': None
                            },
                            'has_spectral_data': False
                        }
                    ]
                }
            ],
            'pagination': {
                'total_available': 1000,
                'total_returned': 5,
                'offset': 0,
                'limit': 100,
                'has_more': True,
                'next_offset': 5
            }
        }
        
        mock_data_access.get_asteroids_by_classification.return_value = classification_data
        
        # Make request
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=100&offset=0')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['system'] == 'bus_demeo'
        assert data['classes'] == classification_data['classes']
        # Check for new pagination format
        if 'pagination' in data:
            assert data['pagination']['limit'] == 100
            assert data['pagination']['offset'] == 0
        else:
            # Fallback to old format
            assert data['pagination']['limit'] == 100
            assert data['pagination']['offset'] == 0
            assert data['pagination']['total'] == 5  # 3 + 2 asteroids
        
        mock_data_access.get_asteroids_by_classification.assert_called_once_with(
            system='bus_demeo', limit=100, offset=0, per_class_limit=None, stream_results=False
        )
    
    def test_get_classification_asteroids_tholen_success(self, client, mock_data_access):
        """Test successful retrieval of Tholen classification asteroids."""
        classification_data = {
            'classes': [
                {
                    'name': 'G',
                    'count': 1,
                    'asteroids': [
                        {
                            'id': 1,
                            'display_name': 'Ceres',
                            'identifiers': {
                                'official_number': 1,
                                'proper_name': 'Ceres',
                                'provisional_designation': None
                            },
                            'has_spectral_data': True
                        }
                    ]
                }
            ],
            'pagination': {
                'total_available': 100,
                'total_returned': 1,
                'offset': 0,
                'limit': None,
                'has_more': False,
                'next_offset': None
            }
        }
        
        mock_data_access.get_asteroids_by_classification.return_value = classification_data
        
        response = client.get('/api/classifications/tholen/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['system'] == 'tholen'
        assert data['classes'] == classification_data['classes']
        
        mock_data_access.get_asteroids_by_classification.assert_called_once_with(
            system='tholen', limit=None, offset=0, per_class_limit=None, stream_results=False
        )
    
    def test_get_classification_asteroids_invalid_system(self, client):
        """Test invalid classification system."""
        response = client.get('/api/classifications/invalid_system/asteroids')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid classification system' in data['error'].lower()
        assert 'bus_demeo' in data['message']
        assert 'tholen' in data['message']
    
    def test_get_classification_asteroids_custom_pagination(self, client, mock_data_access):
        """Test custom pagination parameters."""
        mock_data_access.get_asteroids_by_classification.return_value = {
            'classes': [],
            'pagination': {
                'total_available': 0,
                'total_returned': 0,
                'offset': 100,
                'limit': 50,
                'has_more': False,
                'next_offset': None
            }
        }
        
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=50&offset=100')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['pagination']['limit'] == 50
        assert data['pagination']['offset'] == 100
        
        mock_data_access.get_asteroids_by_classification.assert_called_once_with(
            system='bus_demeo', limit=50, offset=100, per_class_limit=None, stream_results=False
        )
    
    def test_get_classification_asteroids_invalid_limit_too_high(self, client):
        """Test invalid limit parameter (too high)."""
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=200000')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
        assert '100000' in data['message']
    
    def test_get_classification_asteroids_invalid_limit_too_low(self, client):
        """Test invalid limit parameter (too low)."""
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=0')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
    
    def test_get_classification_asteroids_invalid_limit_negative(self, client):
        """Test invalid limit parameter (negative)."""
        response = client.get('/api/classifications/bus_demeo/asteroids?limit=-10')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
    
    def test_get_classification_asteroids_invalid_offset_negative(self, client):
        """Test invalid offset parameter (negative)."""
        response = client.get('/api/classifications/bus_demeo/asteroids?offset=-1')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid offset' in data['error'].lower()
        assert 'non-negative' in data['message']
    
    def test_get_classification_asteroids_default_pagination(self, client, mock_data_access):
        """Test default pagination parameters."""
        mock_data_access.get_asteroids_by_classification.return_value = {
            'classes': [],
            'pagination': {
                'total_available': 0,
                'total_returned': 0,
                'offset': 0,
                'limit': None,
                'has_more': False,
                'next_offset': None
            }
        }
        
        response = client.get('/api/classifications/bus_demeo/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['pagination']['limit'] is None  # Default limit (unlimited)
        assert data['pagination']['offset'] == 0     # Default offset
        
        mock_data_access.get_asteroids_by_classification.assert_called_once_with(
            system='bus_demeo', limit=None, offset=0, per_class_limit=None, stream_results=False
        )
    
    def test_get_classification_asteroids_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_asteroids_by_classification.side_effect = Exception("Database error")
        
        response = client.get('/api/classifications/bus_demeo/asteroids')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to fetch' in data['error'].lower()
    
    def test_get_classification_asteroids_empty_result(self, client, mock_data_access):
        """Test handling of empty classification results."""
        mock_data_access.get_asteroids_by_classification.return_value = {
            'classes': [],
            'pagination': {
                'total_available': 0,
                'total_returned': 0,
                'offset': 0,
                'limit': None,
                'has_more': False,
                'next_offset': None
            }
        }
        
        response = client.get('/api/classifications/bus_demeo/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['classes'] == []
        assert data['pagination']['total_available'] == 0
    
    def test_get_classification_asteroids_mixed_spectral_data(self, client, mock_data_access):
        """Test asteroids with mixed spectral data availability."""
        classification_data = {
            'classes': [
                {
                    'name': 'S',
                    'count': 2,
                    'asteroids': [
                        {
                            'id': 1,
                            'display_name': 'Asteroid 1',
                            'identifiers': {'official_number': 1},
                            'has_spectral_data': True
                        },
                        {
                            'id': 2,
                            'display_name': 'Asteroid 2',
                            'identifiers': {'official_number': 2},
                            'has_spectral_data': False
                        }
                    ]
                }
            ],
            'pagination': {
                'total_available': 2,
                'total_returned': 2,
                'offset': 0,
                'limit': None,
                'has_more': False,
                'next_offset': None
            }
        }
        
        mock_data_access.get_asteroids_by_classification.return_value = classification_data
        
        response = client.get('/api/classifications/bus_demeo/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        
        # Check that spectral data flags are preserved
        asteroids = data['classes'][0]['asteroids']
        assert asteroids[0]['has_spectral_data'] is True
        assert asteroids[1]['has_spectral_data'] is False


class TestSingleClassificationAsteroids:
    """Test cases for single classification asteroids endpoint."""
    
    def test_get_single_classification_asteroids_success(self, client, mock_data_access):
        """Test successful retrieval of asteroids for a specific classification."""
        # Mock data
        asteroids_data = {
            'asteroids': [
                {
                    'id': 1,
                    'display_name': 'Ceres',
                    'identifiers': {
                        'official_number': 1,
                        'proper_name': 'Ceres',
                        'provisional_designation': None
                    },
                    'classification': 'A',
                    'has_spectral_data': True
                },
                {
                    'id': 2,
                    'display_name': 'Asteroid 2',
                    'identifiers': {
                        'official_number': 2,
                        'proper_name': None,
                        'provisional_designation': '2023 AB1'
                    },
                    'classification': 'A',
                    'has_spectral_data': False
                }
            ],
            'pagination': {
                'total_count': 150,
                'returned_count': 2,
                'limit': 100,
                'offset': 0,
                'has_more': True,
                'next_offset': 2
            }
        }
        
        mock_data_access.get_single_classification_asteroids.return_value = asteroids_data
        
        # Make request
        response = client.get('/api/classifications/bus_demeo/A/asteroids?limit=100')
        
        # Assertions
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['system'] == 'bus_demeo'
        assert data['classification'] == 'A'
        assert len(data['asteroids']) == 2
        assert data['pagination']['total_count'] == 150
        assert data['pagination']['has_more'] is True
        
        mock_data_access.get_single_classification_asteroids.assert_called_once_with(
            system='bus_demeo',
            classification_name='A',
            limit=100,
            offset=0
        )
    
    def test_get_single_classification_asteroids_invalid_system(self, client):
        """Test invalid classification system."""
        response = client.get('/api/classifications/invalid_system/A/asteroids')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid classification system' in data['error'].lower()
    
    def test_get_single_classification_asteroids_invalid_limit(self, client):
        """Test invalid limit parameter."""
        response = client.get('/api/classifications/bus_demeo/A/asteroids?limit=20000')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid limit' in data['error'].lower()
    
    def test_get_single_classification_asteroids_invalid_offset(self, client):
        """Test invalid offset parameter."""
        response = client.get('/api/classifications/bus_demeo/A/asteroids?offset=-1')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'invalid offset' in data['error'].lower()
    
    def test_get_single_classification_asteroids_empty_result(self, client, mock_data_access):
        """Test handling of empty results."""
        asteroids_data = {
            'asteroids': [],
            'pagination': {
                'total_count': 0,
                'returned_count': 0,
                'limit': 100,
                'offset': 0,
                'has_more': False,
                'next_offset': None
            }
        }
        
        mock_data_access.get_single_classification_asteroids.return_value = asteroids_data
        
        response = client.get('/api/classifications/bus_demeo/Z/asteroids')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert len(data['asteroids']) == 0
        assert data['pagination']['total_count'] == 0
    
    def test_get_single_classification_asteroids_database_error(self, client, mock_data_access):
        """Test database error handling."""
        mock_data_access.get_single_classification_asteroids.side_effect = Exception("Database error")
        
        response = client.get('/api/classifications/bus_demeo/A/asteroids')
        
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'failed to fetch' in data['error'].lower()
    
    def test_get_single_classification_asteroids_pagination(self, client, mock_data_access):
        """Test pagination parameters."""
        asteroids_data = {
            'asteroids': [],
            'pagination': {
                'total_count': 1000,
                'returned_count': 50,
                'limit': 50,
                'offset': 100,
                'has_more': True,
                'next_offset': 150
            }
        }
        
        mock_data_access.get_single_classification_asteroids.return_value = asteroids_data
        
        response = client.get('/api/classifications/tholen/S/asteroids?limit=50&offset=100')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['pagination']['limit'] == 50
        assert data['pagination']['offset'] == 100
        
        mock_data_access.get_single_classification_asteroids.assert_called_once_with(
            system='tholen',
            classification_name='S',
            limit=50,
            offset=100
        )


class TestClassificationAPIIntegration:
    """Integration tests for classification API endpoints."""
    
    def test_systems_to_asteroids_workflow(self, client, mock_data_access):
        """Test workflow from getting systems to getting asteroids."""
        # Mock systems data
        systems_data = {
            'systems': [
                {
                    'name': 'bus_demeo',
                    'display_name': 'Bus-DeMeo',
                    'classes': ['C', 'S']
                }
            ]
        }
        
        # Mock asteroids data
        asteroids_data = {
            'classes': [
                {
                    'name': 'C',
                    'count': 1,
                    'asteroids': [
                        {
                            'id': 1,
                            'display_name': 'Ceres',
                            'identifiers': {'official_number': 1, 'proper_name': 'Ceres'},
                            'has_spectral_data': True
                        }
                    ]
                }
            ]
        }
        
        mock_data_access.get_classification_systems.return_value = systems_data
        mock_data_access.get_asteroids_by_classification.return_value = asteroids_data
        
        # Get classification systems
        systems_response = client.get('/api/classifications')
        systems_response_data = json.loads(systems_response.data)
        
        # Get asteroids for first system
        system_name = systems_response_data['systems'][0]['name']
        asteroids_response = client.get(f'/api/classifications/{system_name}/asteroids')
        asteroids_response_data = json.loads(asteroids_response.data)
        
        # Verify workflow consistency
        assert system_name == asteroids_response_data['system']
        assert asteroids_response_data['status'] == 'success'
        assert len(asteroids_response_data['classes']) > 0
    
    def test_pagination_consistency(self, client, mock_data_access):
        """Test pagination consistency across requests."""
        # Mock data for different pages
        page1_data = {
            'classes': [
                {
                    'name': 'C',
                    'count': 2,
                    'asteroids': [
                        {'id': 1, 'display_name': 'Asteroid 1', 'identifiers': {}, 'has_spectral_data': True},
                        {'id': 2, 'display_name': 'Asteroid 2', 'identifiers': {}, 'has_spectral_data': True}
                    ]
                }
            ],
            'pagination': {
                'total_available': 3,
                'total_returned': 2,
                'offset': 0,
                'limit': 2,
                'has_more': True,
                'next_offset': 2
            }
        }
        
        page2_data = {
            'classes': [
                {
                    'name': 'C',
                    'count': 1,
                    'asteroids': [
                        {'id': 3, 'display_name': 'Asteroid 3', 'identifiers': {}, 'has_spectral_data': True}
                    ]
                }
            ],
            'pagination': {
                'total_available': 3,
                'total_returned': 1,
                'offset': 2,
                'limit': 2,
                'has_more': False,
                'next_offset': None
            }
        }
        
        # Configure mock to return different data based on offset
        def mock_get_asteroids(system, limit, offset, per_class_limit=None, stream_results=False):
            if offset == 0:
                return page1_data
            elif offset == 2:
                return page2_data
            else:
                return {
                    'classes': [],
                    'pagination': {
                        'total_available': 0,
                        'total_returned': 0,
                        'offset': offset,
                        'limit': limit,
                        'has_more': False,
                        'next_offset': None
                    }
                }
        
        mock_data_access.get_asteroids_by_classification.side_effect = mock_get_asteroids
        
        # Get first page
        response1 = client.get('/api/classifications/bus_demeo/asteroids?limit=2&offset=0')
        data1 = json.loads(response1.data)
        
        # Get second page
        response2 = client.get('/api/classifications/bus_demeo/asteroids?limit=2&offset=2')
        data2 = json.loads(response2.data)
        
        # Verify pagination parameters
        assert data1['pagination']['limit'] == 2
        assert data1['pagination']['offset'] == 0
        assert data2['pagination']['limit'] == 2
        assert data2['pagination']['offset'] == 2
        
        # Verify different data returned
        assert data1['classes'][0]['asteroids'][0]['id'] == 1
        assert data2['classes'][0]['asteroids'][0]['id'] == 3