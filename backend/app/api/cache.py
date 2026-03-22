"""
Cache management API endpoints for monitoring and controlling cache performance.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_restful import Resource, Api
from app.services.data_access import get_data_access
from app.utils.cache import (
    get_comprehensive_cache_stats, 
    invalidate_cache_by_data_change,
    get_warming_service
)
from app.utils.error_handlers import safe_execute, ValidationError

cache_bp = Blueprint('cache', __name__)
api = Api(cache_bp)

class CacheStats(Resource):
    """Get comprehensive cache statistics and performance metrics."""
    
    def get(self):
        """Return comprehensive cache statistics."""
        def fetch_cache_stats():
            data_access = get_data_access()
            return data_access.get_cache_performance_report()
        
        cache_stats = safe_execute(
            fetch_cache_stats,
            error_message='Failed to fetch cache statistics',
            error_type=Exception
        )
        
        return {
            'cache_stats': cache_stats,
            'status': 'success'
        }, 200

class CacheWarming(Resource):
    """Manage cache warming operations."""
    
    def post(self):
        """Trigger cache warming for popular data."""
        def execute_warming():
            data_access = get_data_access()
            return data_access.warm_cache_for_popular_data()
        
        warming_results = safe_execute(
            execute_warming,
            error_message='Failed to execute cache warming',
            error_type=Exception
        )
        
        return {
            'warming_results': warming_results,
            'status': 'success'
        }, 200
    
    def get(self):
        """Get cache warming service status and strategies."""
        try:
            warming_service = get_warming_service()
            
            # Get warming service statistics
            strategies_info = {}
            for name, strategy in warming_service._warming_strategies.items():
                strategies_info[name] = {
                    'last_run': strategy['last_run'],
                    'run_count': strategy['run_count'],
                    'conditions': strategy['conditions']
                }
            
            return {
                'warming_service': {
                    'enabled': True,
                    'strategies_count': len(strategies_info),
                    'strategies': strategies_info
                },
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching cache warming status: {e}')
            return {
                'error': 'Failed to fetch cache warming status',
                'message': str(e),
                'status': 'error'
            }, 500

class CacheInvalidation(Resource):
    """Manage cache invalidation operations."""
    
    def post(self):
        """Invalidate caches based on data changes."""
        try:
            data = request.get_json()
            
            if not data or 'data_type' not in data:
                raise ValidationError('Missing required field: data_type')
            
            data_type = data['data_type']
            valid_types = ['asteroids', 'observations', 'classifications', 'all']
            
            if data_type not in valid_types:
                raise ValidationError(
                    f'Invalid data_type. Must be one of: {", ".join(valid_types)}'
                )
            
            def execute_invalidation():
                if data_type == 'all':
                    # Invalidate all caches
                    results = {}
                    for dt in ['asteroids', 'observations', 'classifications']:
                        data_access = get_data_access()
                        results[dt] = data_access.invalidate_cache_for_data_update(dt)
                    return results
                else:
                    data_access = get_data_access()
                    return data_access.invalidate_cache_for_data_update(data_type)
            
            invalidation_results = safe_execute(
                execute_invalidation,
                error_message=f'Failed to invalidate cache for data type: {data_type}',
                error_type=Exception
            )
            
            return {
                'invalidation_results': invalidation_results,
                'data_type': data_type,
                'status': 'success'
            }, 200
            
        except ValidationError as e:
            return {
                'error': 'Validation error',
                'message': str(e),
                'status': 'error'
            }, 400
        except Exception as e:
            current_app.logger.error(f'Error invalidating cache: {e}')
            return {
                'error': 'Failed to invalidate cache',
                'message': str(e),
                'status': 'error'
            }, 500

class CacheOptimization(Resource):
    """Get cache optimization suggestions and recommendations."""
    
    def get(self):
        """Get cache optimization suggestions."""
        try:
            from app.utils.cache import get_multi_level_cache
            
            multi_level_cache = get_multi_level_cache()
            optimization_data = multi_level_cache.get_optimization_suggestions()
            
            # Add system-level recommendations
            cache_stats = get_comprehensive_cache_stats()
            system_recommendations = []
            
            overall_hit_rate = cache_stats['system_overall']['overall_hit_rate']
            if overall_hit_rate < 0.7:
                system_recommendations.append({
                    'type': 'increase_cache_sizes',
                    'priority': 'high',
                    'description': f'System hit rate is {overall_hit_rate:.1%}. Consider increasing cache sizes.',
                    'impact': 'high'
                })
            
            l1_utilization = (cache_stats['multi_level_cache']['l1_cache']['size'] / 
                             cache_stats['multi_level_cache']['l1_cache']['max_size'])
            if l1_utilization > 0.9:
                system_recommendations.append({
                    'type': 'l1_cache_expansion',
                    'priority': 'medium',
                    'description': f'L1 cache is {l1_utilization:.1%} full. Consider expansion.',
                    'impact': 'medium'
                })
            
            return {
                'optimization_suggestions': optimization_data,
                'system_recommendations': system_recommendations,
                'cache_performance': {
                    'overall_hit_rate': overall_hit_rate,
                    'l1_utilization': l1_utilization,
                    'efficiency_rating': cache_stats['system_overall']['cache_efficiency']
                },
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error generating cache optimization suggestions: {e}')
            return {
                'error': 'Failed to generate optimization suggestions',
                'message': str(e),
                'status': 'error'
            }, 500

class CacheHealth(Resource):
    """Get cache health status and alerts."""
    
    def get(self):
        """Get cache health status."""
        try:
            cache_stats = get_comprehensive_cache_stats()
            
            # Determine health status
            overall_hit_rate = cache_stats['system_overall']['overall_hit_rate']
            health_status = 'healthy'
            alerts = []
            
            if overall_hit_rate < 0.5:
                health_status = 'critical'
                alerts.append({
                    'level': 'critical',
                    'message': f'Very low cache hit rate: {overall_hit_rate:.1%}',
                    'recommendation': 'Immediate cache optimization required'
                })
            elif overall_hit_rate < 0.7:
                health_status = 'warning'
                alerts.append({
                    'level': 'warning',
                    'message': f'Low cache hit rate: {overall_hit_rate:.1%}',
                    'recommendation': 'Consider cache tuning'
                })
            
            # Check for cache size issues
            for cache_name in ['l1_cache', 'l2_cache']:
                if cache_name in cache_stats['multi_level_cache']:
                    cache_info = cache_stats['multi_level_cache'][cache_name]
                    utilization = cache_info['size'] / cache_info['max_size']
                    
                    if utilization > 0.95:
                        alerts.append({
                            'level': 'warning',
                            'message': f'{cache_name} is {utilization:.1%} full',
                            'recommendation': f'Consider increasing {cache_name} size'
                        })
            
            return {
                'health_status': health_status,
                'overall_hit_rate': overall_hit_rate,
                'alerts': alerts,
                'cache_efficiency': cache_stats['system_overall']['cache_efficiency'],
                'last_check': cache_stats.get('report_timestamp'),
                'status': 'success'
            }, 200
            
        except Exception as e:
            current_app.logger.error(f'Error checking cache health: {e}')
            return {
                'error': 'Failed to check cache health',
                'message': str(e),
                'status': 'error'
            }, 500

# Register resources with API
api.add_resource(CacheStats, '/cache/stats')
api.add_resource(CacheWarming, '/cache/warming')
api.add_resource(CacheInvalidation, '/cache/invalidation')
api.add_resource(CacheOptimization, '/cache/optimization')
api.add_resource(CacheHealth, '/cache/health')