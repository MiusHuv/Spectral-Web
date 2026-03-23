"""
Asteroids API endpoints - Real database implementation
"""
from flask import Blueprint, jsonify, request
from flask_restful import Api, Resource
from app.services.database_service import get_database_service
import logging
import numpy as np
import json

logger = logging.getLogger(__name__)

asteroids_real_bp = Blueprint('asteroids_real', __name__)
api = Api(asteroids_real_bp)


def _safe_int(value, default: int = 0) -> int:
    """Convert any scalar to int safely, with fallback."""
    try:
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _extract_count_value(df, column: str, default: int = 0) -> int:
    """Read a count-like value from DataFrame/dict results safely."""
    if df is None:
        return default

    try:
        if hasattr(df, 'empty') and df.empty:
            return default

        if hasattr(df, 'columns') and column in df.columns:
            return _safe_int(df[column].iloc[0], default)

        if hasattr(df, 'iloc'):
            return _safe_int(df.iloc[0, 0], default)

        if isinstance(df, dict):
            return _safe_int(df.get(column), default)
    except Exception:
        return default

    return default

class AsteroidsList(Resource):
    """Get list of asteroids with filtering and pagination"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            # Get query parameters
            page = _safe_int(request.args.get('page', 1), 1)
            page_size = _safe_int(request.args.get('page_size', 50), 50)
            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            bus_demeo_class = request.args.get('bus_demeo_class')
            tholen_class = request.args.get('tholen_class')
            orbital_class = request.args.get('orbital_class')
            # Search parameters
            search_query = request.args.get('search', '').strip()
            search_type = request.args.get('search_type', 'all')
            search_field = request.args.get('search_field', 'all')
            
            # Physical property filters
            diameter_min = request.args.get('diameter_min', type=float)
            diameter_max = request.args.get('diameter_max', type=float)
            albedo_min = request.args.get('albedo_min', type=float)
            albedo_max = request.args.get('albedo_max', type=float)
            
            # Orbital parameter filters
            semi_major_axis_min = request.args.get('semi_major_axis_min', type=float)
            semi_major_axis_max = request.args.get('semi_major_axis_max', type=float)
            eccentricity_min = request.args.get('eccentricity_min', type=float)
            eccentricity_max = request.args.get('eccentricity_max', type=float)
            inclination_min = request.args.get('inclination_min', type=float)
            inclination_max = request.args.get('inclination_max', type=float)
            
            # Observation filter
            has_observations = request.args.get('has_observations')
            
            # Mission filter
            mission = request.args.get('mission')
            
            # Sort parameters
            sort_by = request.args.get('sort_by', 'official_number')
            sort_order = request.args.get('sort_order', 'asc').lower()
            
            # Validate sort parameters
            valid_sort_columns = [
                'official_number', 'proper_name', 'provisional_designation',
                'bus_demeo_class', 'tholen_class', 'orbital_class',
                'semi_major_axis', 'eccentricity', 'inclination',
                'diameter', 'albedo', 'observation_count'
            ]
            
            if sort_by not in valid_sort_columns:
                sort_by = 'official_number'
            
            if sort_order not in ['asc', 'desc']:
                sort_order = 'asc'
            
            # Build query with parameterized queries to prevent SQL injection
            where_clauses = []
            params = []
            
            # Classification filters
            if bus_demeo_class:
                if bus_demeo_class == 'UNCLASSIFIED':
                    where_clauses.append("(bus_demeo_class IS NULL OR bus_demeo_class = '')")
                else:
                    where_clauses.append("bus_demeo_class = %s")
                    params.append(bus_demeo_class)
            
            if tholen_class:
                if tholen_class == 'UNCLASSIFIED':
                    where_clauses.append("(tholen_class IS NULL OR tholen_class = '')")
                else:
                    where_clauses.append("tholen_class = %s")
                    params.append(tholen_class)
            
            if orbital_class:
                where_clauses.append("orbital_class = %s")
                params.append(orbital_class)
            
            # Physical property filters
            if diameter_min is not None:
                where_clauses.append("diameter >= %s")
                params.append(diameter_min)
            if diameter_max is not None:
                where_clauses.append("diameter <= %s")
                params.append(diameter_max)
            
            if albedo_min is not None:
                where_clauses.append("albedo >= %s")
                params.append(albedo_min)
            if albedo_max is not None:
                where_clauses.append("albedo <= %s")
                params.append(albedo_max)
            
            # Orbital parameter filters
            if semi_major_axis_min is not None:
                where_clauses.append("semi_major_axis >= %s")
                params.append(semi_major_axis_min)
            if semi_major_axis_max is not None:
                where_clauses.append("semi_major_axis <= %s")
                params.append(semi_major_axis_max)
            
            if eccentricity_min is not None:
                where_clauses.append("eccentricity >= %s")
                params.append(eccentricity_min)
            if eccentricity_max is not None:
                where_clauses.append("eccentricity <= %s")
                params.append(eccentricity_max)
            
            if inclination_min is not None:
                where_clauses.append("inclination >= %s")
                params.append(inclination_min)
            if inclination_max is not None:
                where_clauses.append("inclination <= %s")
                params.append(inclination_max)
            
            # Mission filter - need to join with observations table
            mission_join = ""
            if mission:
                mission_join = """
                    INNER JOIN (
                        SELECT DISTINCT asteroid_id 
                        FROM observations 
                        WHERE mission = %s
                    ) obs_filter ON a.id = obs_filter.asteroid_id
                """
                params.insert(0, mission)  # Add mission param at the beginning
            
            # Search functionality
            if search_query:
                # Determine which fields to search
                if search_field != 'all':
                    # Search specific field - validate field name to prevent SQL injection
                    valid_fields = ['official_number', 'proper_name', 'provisional_designation', 
                                    'bus_demeo_class', 'tholen_class', 'orbital_class']
                    if search_field in valid_fields:
                        if search_type == 'exact':
                            where_clauses.append(f"{search_field} = %s")
                            params.append(search_query)
                        else:  # fuzzy or smart
                            where_clauses.append(f"{search_field} LIKE %s")
                            params.append(f"%{search_query}%")
                else:
                    # Search all fields
                    if search_type == 'exact':
                        # Exact match
                        search_conditions = [
                            "official_number = %s",
                            "proper_name = %s", 
                            "provisional_designation = %s",
                            "bus_demeo_class = %s",
                            "tholen_class = %s"
                        ]
                        search_clause = f"({' OR '.join(search_conditions)})"
                        where_clauses.append(search_clause)
                        for _ in search_conditions:
                            params.append(search_query)
                    elif search_type == 'fuzzy':
                        # Fuzzy match with LIKE
                        search_conditions = [
                            "proper_name LIKE %s",
                            "provisional_designation LIKE %s", 
                            "bus_demeo_class LIKE %s",
                            "tholen_class LIKE %s",
                            "orbital_class LIKE %s"
                        ]
                        search_clause = f"({' OR '.join(search_conditions)})"
                        where_clauses.append(search_clause)
                        fuzzy_term = f"%{search_query}%"
                        for _ in search_conditions:
                            params.append(fuzzy_term)
                    else:  # 'all' - smart search
                        # Try number first, then fuzzy text
                        try:
                            search_num = int(search_query)
                            number_condition = "official_number = %s"
                            params.append(search_num)
                        except ValueError:
                            number_condition = "1=0"
                        
                        text_conditions = [
                            "proper_name LIKE %s",
                            "provisional_designation LIKE %s",
                            "bus_demeo_class LIKE %s", 
                            "tholen_class LIKE %s",
                            "orbital_class LIKE %s"
                        ]
                        all_conditions = [number_condition] + text_conditions
                        search_clause = f"({' OR '.join(all_conditions)})"
                        where_clauses.append(search_clause)
                        
                        fuzzy_term = f"%{search_query}%"
                        for _ in text_conditions:
                            params.append(fuzzy_term)
            
            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            
            # Add observation filter (needs subquery)
            if has_observations == 'true':
                where_clauses.append("EXISTS (SELECT 1 FROM observations o WHERE o.asteroid_id = a.id)")
                where_sql = f"WHERE {' AND '.join(where_clauses)}"
            elif has_observations == 'false':
                where_clauses.append("NOT EXISTS (SELECT 1 FROM observations o WHERE o.asteroid_id = a.id)")
                where_sql = f"WHERE {' AND '.join(where_clauses)}"
            
            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM asteroids a {mission_join} {where_sql}"
            count_result = db_service.execute_query(count_query, tuple(params) if params else None)
            total = _extract_count_value(count_result, 'total', 0)
            
            # Build ORDER BY clause with NULL handling
            # Default multi-column sort for official_number
            if sort_by == 'official_number' and sort_order == 'asc':
                order_clause = """
                    ORDER BY 
                        CASE WHEN a.official_number IS NULL THEN 1 ELSE 0 END,
                        a.official_number ASC,
                        CASE WHEN a.provisional_designation IS NULL THEN 1 ELSE 0 END,
                        a.provisional_designation ASC,
                        CASE WHEN a.proper_name IS NULL THEN 1 ELSE 0 END,
                        a.proper_name ASC
                """
            else:
                # Single column sort with NULL handling
                if sort_order == 'desc':
                    order_clause = f"""
                        ORDER BY 
                            CASE WHEN a.{sort_by} IS NULL THEN 1 ELSE 0 END,
                            a.{sort_by} DESC
                    """
                else:
                    order_clause = f"""
                        ORDER BY 
                            CASE WHEN a.{sort_by} IS NULL THEN 1 ELSE 0 END,
                            a.{sort_by} ASC
                    """
            
            # Get paginated data with observation count
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT 
                    a.id,
                    a.official_number,
                    a.proper_name,
                    a.provisional_designation,
                    a.bus_demeo_class,
                    a.tholen_class,
                    a.orbital_class,
                    a.semi_major_axis,
                    a.eccentricity,
                    a.inclination,
                    a.diameter,
                    a.albedo,
                    (SELECT COUNT(*) FROM observations o WHERE o.asteroid_id = a.id) as observation_count
                FROM asteroids a
                {mission_join}
                {where_sql}
                {order_clause}
                LIMIT %s OFFSET %s
            """
            
            # Add pagination params
            query_params = tuple(params + [page_size, offset])
            
            df = db_service.execute_query(data_query, query_params)
            
            if df is None or df.empty:
                return {
                    'asteroids': [],
                    'pagination': {
                        'page': page,
                        'page_size': page_size,
                        'total': 0,
                        'total_pages': 0
                    }
                }, 200
            
            # Replace NaN and Inf values with None for JSON serialization
            df = df.replace([np.nan, np.inf, -np.inf], None)
            
            # Convert to list of dicts
            asteroids = df.to_dict('records')
            
            # Calculate pagination info
            total_pages = (total + page_size - 1) // page_size if total > 0 else 0
            
            return {
                'asteroids': asteroids,
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
            logger.error(f"Error fetching asteroids: {e}", exc_info=True)
            return {'error': str(e)}, 500


class AsteroidDetail(Resource):
    """Get detailed information about a specific asteroid"""
    
    def get(self, asteroid_id):
        try:
            db_service = get_database_service()
            
            # Get asteroid basic info
            query = f"""
                SELECT 
                    a.id,
                    a.official_number,
                    a.proper_name,
                    a.provisional_designation,
                    a.bus_demeo_class,
                    a.tholen_class,
                    a.sdss_class,
                    a.orbital_class,
                    a.semi_major_axis,
                    a.eccentricity,
                    a.inclination,
                    a.orbital_period,
                    a.perihelion_distance,
                    a.aphelion_distance,
                    a.diameter,
                    a.albedo,
                    a.rot_per as rotation_period,
                    a.density,
                    a.GM,
                    a.extent
                FROM asteroids a
                WHERE a.id = {asteroid_id}
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'error': 'Asteroid not found'}, 404
            
            # Replace NaN and Inf values with None for JSON serialization
            df = df.replace([np.nan, np.inf, -np.inf], None)
            
            asteroid = df.iloc[0].to_dict()
            
            # Get observation count
            obs_count_query = f"""
                SELECT COUNT(*) as count
                FROM observations
                WHERE asteroid_id = {asteroid_id}
            """
            obs_count_df = db_service.execute_query(obs_count_query)
            asteroid['observation_count'] = _extract_count_value(obs_count_df, 'count', 0)
            
            return {'asteroid': asteroid}, 200
            
        except Exception as e:
            logger.error(f"Error fetching asteroid {asteroid_id}: {e}")
            return {'error': str(e)}, 500


class AsteroidObservations(Resource):
    """Get all observations for a specific asteroid"""
    
    def get(self, asteroid_id):
        try:
            db_service = get_database_service()
            
            query = f"""
                SELECT 
                    o.id,
                    o.asteroid_id,
                    o.start_time,
                    o.stop_time,
                    o.band,
                    o.mission,
                    o.data_source,
                    o.reference_text
                FROM observations o
                WHERE o.asteroid_id = {asteroid_id}
                ORDER BY o.start_time DESC
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'observations': []}, 200
            
            # Replace NaN and Inf values with None for JSON serialization
            df = df.replace([np.nan, np.inf, -np.inf], None)
            
            # Convert datetime columns to strings
            for col in df.columns:
                if df[col].dtype == 'datetime64[ns]' or 'time' in col.lower():
                    df[col] = df[col].astype(str)
            
            observations = df.to_dict('records')
            
            return {
                'asteroid_id': asteroid_id,
                'observations': observations,
                'count': len(observations)
            }, 200
            
        except Exception as e:
            logger.error(f"Error fetching observations for asteroid {asteroid_id}: {e}")
            return {'error': str(e)}, 500


class AsteroidSpectrum(Resource):
    """Get spectrum data for a specific observation"""
    
    def get(self, observation_id):
        try:
            db_service = get_database_service()
            
            query = f"""
                SELECT 
                    o.id,
                    o.asteroid_id,
                    o.spectral_data,
                    o.band,
                    o.start_time,
                    a.proper_name,
                    a.official_number
                FROM observations o
                JOIN asteroids a ON o.asteroid_id = a.id
                WHERE o.id = {observation_id}
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'error': 'Observation not found'}, 404
            
            observation = df.iloc[0].to_dict()
            
            # Parse spectral_data
            spectral_data = None
            if isinstance(observation.get('spectral_data'), str):
                try:
                    spectral_data = json.loads(observation['spectral_data'])
                except:
                    pass
            else:
                spectral_data = observation.get('spectral_data')
            
            if not spectral_data:
                return {'error': 'No spectral data available'}, 404
            
            # Filter out zero or negative wavelengths and their corresponding reflectances
            if 'wavelengths' in spectral_data and 'reflectance' in spectral_data:
                wavelengths = spectral_data['wavelengths']
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
                
                spectral_data['wavelengths'] = filtered_wavelengths
                spectral_data['reflectance'] = filtered_reflectances
            
            return {
                'observation_id': observation['id'],
                'asteroid_id': observation['asteroid_id'],
                'asteroid_name': observation['proper_name'] or f"#{observation['official_number']}",
                'band': observation['band'],
                'observation_date': str(observation['start_time']) if observation['start_time'] else None,
                'spectrum': spectral_data
            }, 200
            
        except Exception as e:
            logger.error(f"Error fetching spectrum for observation {observation_id}: {e}")
            return {'error': str(e)}, 500


class AsteroidClassifications(Resource):
    """Get available asteroid classifications"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            # Get Bus-DeMeo classifications
            bus_query = """
                SELECT 
                    bus_demeo_class,
                    COUNT(*) as count
                FROM asteroids
                WHERE bus_demeo_class IS NOT NULL AND bus_demeo_class != ''
                GROUP BY bus_demeo_class
                ORDER BY count DESC
            """
            
            # Get unclassified Bus-DeMeo count
            bus_unclassified_query = """
                SELECT 
                    COUNT(*) as count
                FROM asteroids
                WHERE bus_demeo_class IS NULL OR bus_demeo_class = ''
            """
            
            # Get Tholen classifications
            tholen_query = """
                SELECT 
                    tholen_class,
                    COUNT(*) as count
                FROM asteroids
                WHERE tholen_class IS NOT NULL AND tholen_class != ''
                GROUP BY tholen_class
                ORDER BY count DESC
            """
            
            # Get unclassified Tholen count
            tholen_unclassified_query = """
                SELECT 
                    COUNT(*) as count
                FROM asteroids
                WHERE tholen_class IS NULL OR tholen_class = ''
            """
            
            bus_df = db_service.execute_query(bus_query)
            bus_unclass_df = db_service.execute_query(bus_unclassified_query)
            tholen_df = db_service.execute_query(tholen_query)
            tholen_unclass_df = db_service.execute_query(tholen_unclassified_query)
            
            # Build Bus-DeMeo list with unclassified
            bus_list = bus_df.to_dict('records') if bus_df is not None and not bus_df.empty else []
            if bus_unclass_df is not None and not bus_unclass_df.empty:
                unclass_count = _extract_count_value(bus_unclass_df, 'count', 0)
                if unclass_count > 0:
                    bus_list.append({'bus_demeo_class': 'UNCLASSIFIED', 'count': unclass_count})
            
            # Build Tholen list with unclassified
            tholen_list = tholen_df.to_dict('records') if tholen_df is not None and not tholen_df.empty else []
            if tholen_unclass_df is not None and not tholen_unclass_df.empty:
                unclass_count = _extract_count_value(tholen_unclass_df, 'count', 0)
                if unclass_count > 0:
                    tholen_list.append({'tholen_class': 'UNCLASSIFIED', 'count': unclass_count})
            
            result = {
                'bus_demeo': bus_list,
                'tholen': tholen_list
            }
            
            return {'classifications': result}, 200
            
        except Exception as e:
            logger.error(f"Error fetching asteroid classifications: {e}", exc_info=True)
            return {'error': str(e)}, 500


class AsteroidStats(Resource):
    """Get asteroid database statistics"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            stats_query = """
                SELECT 
                    COUNT(DISTINCT a.id) as total_asteroids,
                    COUNT(DISTINCT o.id) as total_observations,
                    COUNT(DISTINCT a.bus_demeo_class) as bus_demeo_classes,
                    COUNT(DISTINCT a.tholen_class) as tholen_classes
                FROM asteroids a
                LEFT JOIN observations o ON a.id = o.asteroid_id
            """
            
            df = db_service.execute_query(stats_query)
            
            if df is None or df.empty:
                return {'stats': {}}, 200
            
            stats = df.iloc[0].to_dict()
            
            return {'stats': stats}, 200
            
        except Exception as e:
            logger.error(f"Error fetching asteroid stats: {e}")
            return {'error': str(e)}, 500


class OrbitalClasses(Resource):
    """Get available orbital classes"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            query = """
                SELECT 
                    orbital_class,
                    COUNT(*) as count
                FROM asteroids
                WHERE orbital_class IS NOT NULL AND orbital_class != ''
                GROUP BY orbital_class
                ORDER BY count DESC
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'orbital_classes': []}, 200
            
            orbital_classes = df.to_dict('records')
            
            return {'orbital_classes': orbital_classes}, 200
            
        except Exception as e:
            logger.error(f"Error fetching orbital classes: {e}", exc_info=True)
            return {'error': str(e)}, 500


class Missions(Resource):
    """Get available missions from observations"""
    
    def get(self):
        try:
            db_service = get_database_service()
            
            query = """
                SELECT 
                    o.mission,
                    COUNT(DISTINCT o.asteroid_id) as asteroid_count,
                    COUNT(*) as observation_count
                FROM observations o
                WHERE o.mission IS NOT NULL AND o.mission != ''
                GROUP BY o.mission
                ORDER BY observation_count DESC
            """
            
            df = db_service.execute_query(query)
            
            if df is None or df.empty:
                return {'missions': []}, 200
            
            missions = df.to_dict('records')
            
            return {'missions': missions}, 200
            
        except Exception as e:
            logger.error(f"Error fetching missions: {e}", exc_info=True)
            return {'error': str(e)}, 500


# Register endpoints
api.add_resource(AsteroidsList, '/asteroids')
api.add_resource(AsteroidDetail, '/asteroids/<int:asteroid_id>')
api.add_resource(AsteroidObservations, '/asteroids/<int:asteroid_id>/observations')
api.add_resource(AsteroidSpectrum, '/asteroids/observations/<int:observation_id>/spectrum')
api.add_resource(AsteroidClassifications, '/asteroids/classifications')
api.add_resource(AsteroidStats, '/asteroids/stats')
api.add_resource(OrbitalClasses, '/asteroids/orbital-classes')
api.add_resource(Missions, '/asteroids/missions')
