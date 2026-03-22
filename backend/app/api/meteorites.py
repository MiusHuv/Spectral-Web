"""
Meteorites API endpoints
"""
from flask import Blueprint, jsonify, request
from flask_restful import Api, Resource
from app.services.database_service import get_database_service
import logging

logger = logging.getLogger(__name__)

meteorites_bp = Blueprint('meteorites', __name__)
api = Api(meteorites_bp)

class MeteoritesList(Resource):
    """Get list of meteorites with filtering and pagination"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            # Get query parameters
            page = int(request.args.get('page', 1))
            page_size = int(request.args.get('page_size', 50))
            main_label = request.args.get('main_label')  # Filter by main classification
            specimen_type = request.args.get('specimen_type')
            # Search parameters
            search_query = request.args.get('search', '').strip()
            search_type = request.args.get('search_type', 'all')
            search_field = request.args.get('search_field', 'all')
            
            # Sort parameters
            sort_by = request.args.get('sort_by', 'specimen_id')
            sort_order = request.args.get('sort_order', 'asc').lower()
            
            # Validate sort parameters
            valid_sort_columns = [
                'specimen_id', 'specimen_name', 'specimen_type',
                'main_label', 'sub_label', 'sub_sub_label'
            ]
            
            if sort_by not in valid_sort_columns:
                sort_by = 'specimen_id'
            
            if sort_order not in ['asc', 'desc']:
                sort_order = 'asc'
            
            # Build query
            where_clauses = []
            if main_label:
                # Search in all classification levels (main, sub, sub_sub)
                classification_conditions = [
                    f"main_label = '{main_label}'",
                    f"sub_label = '{main_label}'",
                    f"sub_sub_label = '{main_label}'"
                ]
                where_clauses.append(f"({' OR '.join(classification_conditions)})")
            if specimen_type:
                where_clauses.append(f"specimen_type = '{specimen_type}'")
            
            # Search functionality
            if search_query:
                # Determine which fields to search
                if search_field != 'all':
                    # Search specific field - validate field name to prevent SQL injection
                    valid_fields = ['specimen_name', 'main_label', 'sub_label', 'specimen_type']
                    if search_field in valid_fields:
                        if search_type == 'exact':
                            where_clauses.append(f"{search_field} = '{search_query}'")
                        else:  # fuzzy or smart
                            where_clauses.append(f"{search_field} LIKE '%{search_query}%'")
                else:
                    # Search all fields
                    if search_type == 'exact':
                        search_conditions = [
                            f"specimen_name = '{search_query}'",
                            f"main_label = '{search_query}'",
                            f"sub_label = '{search_query}'",
                            f"specimen_type = '{search_query}'"
                        ]
                        where_clauses.append(f"({' OR '.join(search_conditions)})")
                    elif search_type == 'fuzzy':
                        search_conditions = [
                            f"specimen_name LIKE '%{search_query}%'",
                            f"main_label LIKE '%{search_query}%'",
                            f"sub_label LIKE '%{search_query}%'",
                            f"specimen_type LIKE '%{search_query}%'"
                        ]
                        where_clauses.append(f"({' OR '.join(search_conditions)})")
                    else:  # 'all' - smart search
                        search_conditions = [
                            f"specimen_name LIKE '%{search_query}%'",
                            f"main_label LIKE '%{search_query}%'",
                            f"sub_label LIKE '%{search_query}%'",
                            f"specimen_type LIKE '%{search_query}%'"
                        ]
                        where_clauses.append(f"({' OR '.join(search_conditions)})")
            
            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            
            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM meteorites {where_sql}"
            count_result = db_service.execute_query(count_query)
            total = int(count_result['total'].iloc[0]) if count_result is not None else 0
            
            # Build ORDER BY clause with NULL handling
            if sort_order == 'desc':
                order_clause = f"""
                    ORDER BY 
                        CASE WHEN {sort_by} IS NULL THEN 1 ELSE 0 END,
                        {sort_by} DESC
                """
            else:
                order_clause = f"""
                    ORDER BY 
                        CASE WHEN {sort_by} IS NULL THEN 1 ELSE 0 END,
                        {sort_by} ASC
                """
            
            # Get paginated data
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT 
                    id,
                    specimen_id,
                    specimen_name,
                    specimen_type,
                    main_label,
                    sub_label,
                    sub_sub_label
                FROM meteorites
                {where_sql}
                {order_clause}
                LIMIT {page_size} OFFSET {offset}
            """
            
            df = db_service.execute_query(data_query)
            
            if df is None or df.empty:
                return {
                    'meteorites': [],
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total': 0,
                        'total_pages': 0
                    }
                }, 200
            
            # Convert to list of dicts
            meteorites = df.to_dict('records')
            
            # Calculate pagination info
            total_pages = (total + page_size - 1) // page_size
            
            return {
                'meteorites': meteorites,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total,
                    'total_pages': total_pages,
                    'has_next': page < total_pages,
                    'has_prev': page > 1
                }
            }, 200
            
        except Exception as e:
            logger.error(f"Error fetching meteorites: {e}")
            return {'error': str(e)}, 500


class MeteoriteDetail(Resource):
    """Get detailed information about a specific meteorite"""
    
    def get(self, meteorite_id):
        try:
            db_service = get_database_service()
            
            query = f"""
                SELECT 
                    id,
                    specimen_id,
                    specimen_name,
                    specimen_type,
                    main_label,
                    sub_label,
                    sub_sub_label,
                    spectral_data
                FROM meteorites
                WHERE id = {meteorite_id}
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'error': 'Meteorite not found'}, 404
            
            meteorite = df.iloc[0].to_dict()
            
            # Parse spectral_data if it's a string
            import json
            if isinstance(meteorite.get('spectral_data'), str):
                try:
                    meteorite['spectral_data'] = json.loads(meteorite['spectral_data'])
                except:
                    pass
            
            return {'meteorite': meteorite}, 200
            
        except Exception as e:
            logger.error(f"Error fetching meteorite {meteorite_id}: {e}")
            return {'error': str(e)}, 500


class MeteoriteClassifications(Resource):
    """Get available meteorite classifications with full hierarchy"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            # Get all classification combinations with counts
            query = """
                SELECT 
                    main_label,
                    sub_label,
                    sub_sub_label,
                    COUNT(*) as count
                FROM meteorites
                WHERE main_label IS NOT NULL
                GROUP BY main_label, sub_label, sub_sub_label
                ORDER BY main_label, sub_label, sub_sub_label
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'classifications': []}, 200
            
            # Build hierarchy
            hierarchy = {}
            
            for _, row in df.iterrows():
                main = row['main_label']
                sub = row['sub_label'] if row['sub_label'] else None
                sub_sub = row['sub_sub_label'] if row['sub_sub_label'] else None
                count = int(row['count'])
                
                # Initialize main level
                if main not in hierarchy:
                    hierarchy[main] = {
                        'label': main,
                        'count': 0,
                        'children': {}
                    }
                
                hierarchy[main]['count'] += count
                
                # Add sub level if exists
                if sub:
                    if sub not in hierarchy[main]['children']:
                        hierarchy[main]['children'][sub] = {
                            'label': sub,
                            'count': 0,
                            'children': {}
                        }
                    
                    hierarchy[main]['children'][sub]['count'] += count
                    
                    # Add sub_sub level if exists
                    if sub_sub:
                        if sub_sub not in hierarchy[main]['children'][sub]['children']:
                            hierarchy[main]['children'][sub]['children'][sub_sub] = {
                                'label': sub_sub,
                                'count': 0
                            }
                        
                        hierarchy[main]['children'][sub]['children'][sub_sub]['count'] += count
            
            # Convert to list format
            def convert_to_list(node_dict):
                result = []
                for key, value in sorted(node_dict.items()):
                    node = {
                        'label': value['label'],
                        'count': value['count']
                    }
                    if 'children' in value and value['children']:
                        node['children'] = convert_to_list(value['children'])
                    result.append(node)
                return result
            
            classifications = convert_to_list(hierarchy)
            
            return {'classifications': classifications}, 200
            
        except Exception as e:
            logger.error(f"Error fetching meteorite classifications: {e}")
            return {'error': str(e)}, 500


class MeteoriteSpectrum(Resource):
    """Get spectrum data for a meteorite"""
    
    def get(self, meteorite_id):
        try:
            db_service = get_database_service()
            
            query = f"""
                SELECT 
                    id,
                    specimen_name,
                    spectral_data
                FROM meteorites
                WHERE id = {meteorite_id}
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'error': 'Meteorite not found'}, 404
            
            meteorite = df.iloc[0].to_dict()
            
            # Parse spectral_data
            import json
            spectral_data = None
            if isinstance(meteorite.get('spectral_data'), str):
                try:
                    spectral_data = json.loads(meteorite['spectral_data'])
                except:
                    pass
            else:
                spectral_data = meteorite.get('spectral_data')
            
            if not spectral_data:
                return {'error': 'No spectral data available'}, 404
            
            # Filter out zero or negative wavelengths and their corresponding reflectances
            if 'wavelength' in spectral_data and 'reflectance' in spectral_data:
                wavelengths = spectral_data['wavelength']
                reflectances = spectral_data['reflectance']
                
                # Create filtered lists
                filtered_wavelengths = []
                filtered_reflectances = []
                
                for i in range(min(len(wavelengths), len(reflectances))):
                    wl = wavelengths[i]
                    refl = reflectances[i]
                    # Only keep data points where wavelength > 0 and reflectance >= 0
                    if wl is not None and refl is not None and wl > 0 and refl >= 0:
                        filtered_wavelengths.append(wl)
                        filtered_reflectances.append(refl)
                
                spectral_data['wavelength'] = filtered_wavelengths
                spectral_data['reflectance'] = filtered_reflectances
            
            return {
                'id': meteorite['id'],
                'name': meteorite['specimen_name'],
                'spectrum': spectral_data
            }, 200
            
        except Exception as e:
            logger.error(f"Error fetching spectrum for meteorite {meteorite_id}: {e}")
            return {'error': str(e)}, 500


# Register endpoints
api.add_resource(MeteoritesList, '/meteorites')
api.add_resource(MeteoriteDetail, '/meteorites/<int:meteorite_id>')
api.add_resource(MeteoriteClassifications, '/meteorites/classifications')
api.add_resource(MeteoriteSpectrum, '/meteorites/<int:meteorite_id>/spectrum')
