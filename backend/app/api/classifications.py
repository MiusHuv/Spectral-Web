"""
Classifications API endpoints for asteroid taxonomic classification data.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_restful import Resource, Api
from app.services.data_access import get_data_access

classifications_bp = Blueprint('classifications', __name__)
api = Api(classifications_bp)

class ClassificationSystems(Resource):
    """Get available classification systems."""
    
    def get(self):
        """Return available classification systems (Bus-DeMeo, Tholen)."""
        try:
            # Get classification systems from data access layer
            data_access = get_data_access()
            systems_data = data_access.get_classification_systems()
            
            return {
                'systems': systems_data['systems'],
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching classification systems: {e}')
            return {
                'error': 'Failed to fetch classification systems',
                'message': str(e),
                'status': 'error'
            }, 500

class ClassificationMetadata(Resource):
    """Get classification metadata without loading asteroid data."""
    
    def get(self, system):
        """Return classification metadata (names and counts) for lazy loading."""
        try:
            # Validate system parameter
            valid_systems = ['bus_demeo', 'tholen']
            if system not in valid_systems:
                return {
                    'error': 'Invalid classification system',
                    'message': f'System must be one of: {", ".join(valid_systems)}',
                    'status': 'error'
                }, 400
            
            # Get classification metadata from data access layer
            data_access = get_data_access()
            metadata = data_access.get_classification_metadata(system)
            
            return {
                'metadata': metadata,
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching classification metadata for system {system}: {e}')
            return {
                'error': 'Failed to fetch classification metadata',
                'message': str(e),
                'status': 'error'
            }, 500

class ClassificationAsteroids(Resource):
    """Get asteroids grouped by classification with dynamic pagination."""
    
    def get(self, system):
        """Return asteroids grouped by classification for the specified system."""
        try:
            # Validate system parameter
            valid_systems = ['bus_demeo', 'tholen']
            if system not in valid_systems:
                return {
                    'error': 'Invalid classification system',
                    'message': f'System must be one of: {", ".join(valid_systems)}',
                    'status': 'error'
                }, 400
            
            # Get pagination and optimization parameters
            limit = request.args.get('limit', type=int)  # None for unlimited
            offset = request.args.get('offset', 0, type=int)
            per_class_limit = request.args.get('per_class_limit', type=int)
            stream_results = request.args.get('stream', 'false').lower() == 'true'
            load_asteroids = request.args.get('load_asteroids', 'true').lower() == 'true'
            
            # If load_asteroids is false, return only metadata
            if not load_asteroids:
                data_access = get_data_access()
                metadata = data_access.get_classification_metadata(system)
                return {
                    'system': system,
                    'metadata_only': True,
                    'metadata': metadata,
                    'status': 'success'
                }, 200
            
            # Validate pagination parameters
            if limit is not None and (limit < 1 or limit > 100000):
                return {
                    'error': 'Invalid limit parameter',
                    'message': 'Limit must be between 1 and 100000, or omit for unlimited',
                    'status': 'error'
                }, 400
            
            if per_class_limit is not None and (per_class_limit < 1 or per_class_limit > 10000):
                return {
                    'error': 'Invalid per_class_limit parameter',
                    'message': 'Per-class limit must be between 1 and 10000',
                    'status': 'error'
                }, 400
            
            if offset < 0:
                return {
                    'error': 'Invalid offset parameter',
                    'message': 'Offset must be non-negative',
                    'status': 'error'
                }, 400
            
            # Get asteroids by classification from data access layer
            data_access = get_data_access()
            classification_data = data_access.get_asteroids_by_classification(
                system=system,
                limit=limit,
                offset=offset,
                per_class_limit=per_class_limit,
                stream_results=stream_results
            )
            
            # Handle both old and new response formats for backward compatibility
            if 'pagination' in classification_data:
                # New format with full pagination metadata
                return {
                    'system': system,
                    'classes': classification_data['classes'],
                    'pagination': classification_data['pagination'],
                    'class_counts': classification_data.get('class_counts', {}),
                    'memory_optimized': classification_data.get('memory_optimized', False),
                    'status': 'success'
                }, 200
            else:
                # Fallback to old format for compatibility
                total_asteroids = sum(cls['count'] for cls in classification_data['classes'])
                return {
                    'system': system,
                    'classes': classification_data['classes'],
                    'pagination': {
                        'limit': limit or total_asteroids,
                        'offset': offset,
                        'total': total_asteroids
                    },
                    'status': 'success'
                }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching asteroids for system {system}: {e}')
            return {
                'error': 'Failed to fetch classification data',
                'message': str(e),
                'status': 'error'
            }, 500

class SingleClassificationAsteroids(Resource):
    """Get asteroids for a specific classification with pagination."""
    
    def get(self, system, classification_name):
        """Return asteroids for a specific classification."""
        try:
            # Validate system parameter
            valid_systems = ['bus_demeo', 'tholen']
            if system not in valid_systems:
                return {
                    'error': 'Invalid classification system',
                    'message': f'System must be one of: {", ".join(valid_systems)}',
                    'status': 'error'
                }, 400
            
            # Get pagination parameters
            limit = request.args.get('limit', 1000, type=int)
            offset = request.args.get('offset', 0, type=int)
            
            # Validate pagination parameters
            if limit < 1 or limit > 10000:
                return {
                    'error': 'Invalid limit parameter',
                    'message': 'Limit must be between 1 and 10000',
                    'status': 'error'
                }, 400
            
            if offset < 0:
                return {
                    'error': 'Invalid offset parameter',
                    'message': 'Offset must be non-negative',
                    'status': 'error'
                }, 400
            
            # Get asteroids for specific classification from data access layer
            data_access = get_data_access()
            classification_data = data_access.get_single_classification_asteroids(
                system=system,
                classification_name=classification_name,
                limit=limit,
                offset=offset
            )
            
            return {
                'system': system,
                'classification': classification_name,
                'asteroids': classification_data['asteroids'],
                'pagination': classification_data['pagination'],
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching asteroids for classification {classification_name} in system {system}: {e}')
            return {
                'error': 'Failed to fetch classification asteroids',
                'message': str(e),
                'status': 'error'
            }, 500

# Register resources with API
api.add_resource(ClassificationSystems, '/classifications')
api.add_resource(ClassificationMetadata, '/classifications/<string:system>/metadata')
api.add_resource(ClassificationAsteroids, '/classifications/<string:system>/asteroids')
api.add_resource(SingleClassificationAsteroids, '/classifications/<string:system>/<string:classification_name>/asteroids')