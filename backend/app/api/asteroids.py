"""
Asteroids API endpoints for individual and batch asteroid data retrieval.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_restful import Resource, Api
from app.services.data_access import get_data_access
from app.utils.validation import (
    validate_request, 
    validate_asteroid_detail_request,
    validate_asteroid_batch_request,
    validate_asteroid_search_request
)
from app.utils.error_handlers import safe_execute, DataNotFoundError, DatabaseError

asteroids_bp = Blueprint('asteroids', __name__)
api = Api(asteroids_bp)

class AsteroidDetail(Resource):
    """Get detailed information for a specific asteroid."""
    
    @validate_request(validate_asteroid_detail_request)
    def get(self, asteroid_id):
        """Return detailed asteroid information."""
        asteroid_id = int(asteroid_id)  # Already validated by decorator
        
        def fetch_asteroid():
            data_access = get_data_access()
            asteroid_data = data_access.get_asteroid_details(asteroid_id)
            
            if asteroid_data is None:
                raise DataNotFoundError(
                    f'No asteroid found with ID {asteroid_id}',
                    resource_type='asteroid'
                )
            
            return asteroid_data
        
        asteroid_data = safe_execute(
            fetch_asteroid,
            error_message=f'Failed to fetch asteroid {asteroid_id}',
            error_type=DatabaseError
        )
        
        return {
            'asteroid': asteroid_data,
            'status': 'success'
        }, 200

class AsteroidBatch(Resource):
    """Get data for multiple asteroids."""
    
    @validate_request(validate_asteroid_batch_request)
    def post(self):
        """Return data for multiple asteroids."""
        data = request.get_json()
        asteroid_ids = [int(aid) for aid in data['asteroid_ids']]  # Already validated
        
        def fetch_asteroids():
            data_access = get_data_access()
            return data_access.get_asteroids_batch(asteroid_ids)
        
        asteroids = safe_execute(
            fetch_asteroids,
            error_message='Failed to fetch batch asteroid data',
            error_type=DatabaseError
        )
        
        return {
            'asteroids': asteroids,
            'requested_count': len(asteroid_ids),
            'returned_count': len(asteroids),
            'status': 'success'
        }, 200

class AsteroidSearch(Resource):
    """Search asteroids by name, number, or designation."""
    
    @validate_request(validate_asteroid_search_request)
    def get(self):
        """Search asteroids with query parameter."""
        query = request.args.get('q').strip()  # Already validated
        limit = int(request.args.get('limit', 50))  # Already validated
        
        def search_asteroids():
            data_access = get_data_access()
            return data_access.search_asteroids(query, limit)
        
        results = safe_execute(
            search_asteroids,
            error_message=f'Failed to search asteroids with query "{query}"',
            error_type=DatabaseError
        )
        
        return {
            'query': query,
            'results': results,
            'count': len(results),
            'limit': limit,
            'status': 'success'
        }, 200

# Register resources with API
api.add_resource(AsteroidDetail, '/asteroids/<asteroid_id>')
api.add_resource(AsteroidBatch, '/asteroids/batch')
api.add_resource(AsteroidSearch, '/asteroids/search')