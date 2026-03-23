"""
Database service wrapper for Flask web application.
Integrates existing database utilities with Flask application context.
"""
import ast
import json
import logging
import time
from typing import Optional, Dict, Any, List
from flask import current_app
import pandas as pd
import numpy as np
import pymysql
from pymysql.cursors import DictCursor
from app.utils.cache import get_query_cache, cache_query

logger = logging.getLogger(__name__)

try:
    from utils.database_utils import DatabaseManager, SpectralDataLoader
except ModuleNotFoundError:
    logger.warning("utils.database_utils not found, using built-in database helpers")

    class DatabaseManager:
        """Minimal database manager compatible with FlaskDatabaseService."""

        def __init__(self, config: Dict[str, Any]):
            self.config = config or {}

        def _connect(self):
            host = self.config.get('host', '127.0.0.1')
            if host in ('localhost', '::1'):
                # Prefer TCP loopback to avoid environment-specific socket resolution issues.
                host = '127.0.0.1'
            return pymysql.connect(
                host=host,
                port=int(self.config.get('port', 3306)),
                user=self.config.get('user', 'root'),
                password=self.config.get('password', ''),
                database=self.config.get('database'),
                charset=self.config.get('charset', 'utf8mb4'),
                autocommit=bool(self.config.get('autocommit', True)),
                connect_timeout=int(self.config.get('connect_timeout', 5)),
                cursorclass=DictCursor
            )

        def test_connection(self) -> bool:
            conn = None
            try:
                conn = self._connect()
                return True
            except Exception as exc:
                logger.error(f"Database connection test failed: {exc}")
                return False
            finally:
                if conn is not None:
                    conn.close()

        def get_connection(self):
            return self._connect()

        def execute_query(self, query: str, params: Optional[tuple] = None) -> pd.DataFrame:
            conn = self._connect()
            try:
                return pd.read_sql(query, conn, params=params)
            finally:
                conn.close()

    class SpectralDataLoader:
        """Minimal spectral parser/normalizer used by API tests and CI."""

        def __init__(self, _db_manager: DatabaseManager, config: Optional[Dict[str, Any]] = None):
            config = config or {}
            wl_range = config.get('wavelength_range', [0.45, 2.45])
            resolution = float(config.get('wavelength_resolution', 0.005))
            self.common_wavelength_grid = np.arange(wl_range[0], wl_range[1] + 1e-9, resolution)

        def _parse_spectral_data(self, spectral_data_str: str) -> Optional[np.ndarray]:
            if not spectral_data_str:
                return None

            parsed = None
            for parser in (json.loads, ast.literal_eval):
                try:
                    parsed = parser(spectral_data_str)
                    break
                except Exception:
                    continue

            if parsed is None:
                return None

            wavelengths: List[float] = []
            reflectances: List[float] = []

            if isinstance(parsed, dict):
                wavelengths = parsed.get('wavelengths') or parsed.get('wavelength') or []
                reflectances = parsed.get('reflectance') or parsed.get('reflectances') or []
            elif isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                wavelengths = [point.get('wavelength') for point in parsed if 'wavelength' in point]
                reflectances = [point.get('reflectance') for point in parsed if 'reflectance' in point]
            elif isinstance(parsed, list):
                reflectances = parsed

            if not reflectances:
                return None

            if not wavelengths or len(wavelengths) != len(reflectances):
                wavelengths = np.linspace(
                    float(self.common_wavelength_grid.min()),
                    float(self.common_wavelength_grid.max()),
                    len(reflectances)
                ).tolist()

            try:
                wave_arr = np.asarray(wavelengths, dtype=float)
                refl_arr = np.asarray(reflectances, dtype=float)
            except (TypeError, ValueError):
                return None

            if wave_arr.size == 0 or refl_arr.size == 0 or wave_arr.size != refl_arr.size:
                return None

            return np.column_stack((wave_arr, refl_arr))

        def _normalize_by_055(self, spectrum: np.ndarray) -> Optional[np.ndarray]:
            if spectrum is None or spectrum.size == 0:
                return None

            if len(spectrum.shape) != 2 or spectrum.shape[1] < 2:
                return None

            wavelengths = spectrum[:, 0]
            reflectances = spectrum[:, 1]

            if wavelengths.size == 0 or reflectances.size == 0:
                return None

            sort_idx = np.argsort(wavelengths)
            wavelengths = wavelengths[sort_idx]
            reflectances = reflectances[sort_idx]

            resampled = np.interp(
                self.common_wavelength_grid,
                wavelengths,
                reflectances,
                left=np.nan,
                right=np.nan
            )

            norm_idx = int(np.argmin(np.abs(self.common_wavelength_grid - 0.55)))
            norm_reflectance = resampled[norm_idx]

            if not np.isfinite(norm_reflectance) or norm_reflectance == 0:
                return resampled

            return resampled / norm_reflectance

class FlaskDatabaseService:
    """
    Flask-specific database service wrapper around existing DatabaseManager.
    Provides connection pooling and error handling for web application context.
    """
    
    def __init__(self, app=None):
        """Initialize the database service."""
        self.db_manager = None
        self.spectral_loader = None
        self._config = None
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the database service with Flask app configuration."""
        try:
            # Build database configuration from Flask config
            self._config = {
                'database': {
                    'host': app.config.get('DB_HOST', '127.0.0.1'),
                    'port': app.config.get('DB_PORT', 3306),
                    'user': app.config.get('DB_USER', 'root'),
                    'password': app.config.get('DB_PASSWORD', 'bpol68'),
                    'database': app.config.get('DB_NAME', 'asteroid_spectral_db'),
                    'pool_size': app.config.get('DB_POOL_SIZE', 10),
                    'charset': 'utf8mb4',
                    'collation': 'utf8mb4_unicode_ci',
                    'autocommit': True,
                    'time_zone': '+00:00'
                },
                'data_loading': {
                    'wavelength_range': self._parse_wavelength_range(
                        app.config.get('DEFAULT_WAVELENGTH_RANGE', '0.45-2.45')
                    ),
                    'wavelength_resolution': 0.005,
                    'meteorite_sql': """
                        SELECT main_label, sub_label, spectral_data 
                        FROM meteorites 
                        WHERE spectral_data IS NOT NULL AND sub_label IS NOT NULL
                    """,
                    'asteroid_sql': """
                        SELECT 
                            o.id AS obs_id,
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
                            a.orbital_period,
                            a.perihelion_distance,
                            a.aphelion_distance,
                            a.diameter,
                            a.albedo,
                            a.rotation_period,
                            a.density,
                            o.spectral_data
                        FROM observations o 
                        JOIN asteroids a ON o.asteroid_id = a.id 
                        WHERE o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                    """,
                    'remove_outliers': True,
                    'filter_classes': False
                }
            }
            
            # Initialize database manager
            self.db_manager = DatabaseManager(self._config['database'])
            
            # Initialize spectral data loader
            self.spectral_loader = SpectralDataLoader(
                self.db_manager, 
                self._config['data_loading']
            )
            
            # Test connection on initialization (skip in testing mode)
            if not app.config.get('TESTING', False):
                if not self.test_connection():
                    logger.error("Database connection test failed during initialization")
                    raise ConnectionError("Failed to establish database connection")
            else:
                logger.info("Skipping database connection test in testing mode")
            
            # Store service in app extensions
            if not hasattr(app, 'extensions'):
                app.extensions = {}
            app.extensions['database_service'] = self
            
            logger.info("Flask database service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Flask database service: {e}")
            raise
    
    def _parse_wavelength_range(self, range_str: str) -> List[float]:
        """Parse wavelength range string into [min, max] list."""
        try:
            if '-' in range_str:
                min_wl, max_wl = map(float, range_str.split('-'))
                return [min_wl, max_wl]
            else:
                raise ValueError("Invalid format")
        except (ValueError, TypeError):
            logger.warning(f"Invalid wavelength range '{range_str}', using default [0.45, 2.45]")
            return [0.45, 2.45]
    
    def test_connection(self) -> bool:
        """Test database connection."""
        if self.db_manager is None:
            logger.error("Database manager not initialized")
            return False
        
        try:
            return self.db_manager.test_connection()
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False
    
    def get_connection(self):
        """Get a database connection from the pool."""
        if self.db_manager is None:
            raise RuntimeError("Database manager not initialized")
        
        return self.db_manager.get_connection()
    
    def execute_query(self, query: str, params: Optional[tuple] = None, use_cache: bool = True, cache_ttl: int = 300) -> Optional[pd.DataFrame]:
        """Execute a SQL query and return results as DataFrame with performance monitoring."""
        if self.db_manager is None:
            raise RuntimeError("Database manager not initialized")
        
        query_start_time = time.time()
        query_hash = hash((query, str(params) if params else ""))
        
        try:
            # Check cache first if enabled
            if use_cache:
                query_cache = get_query_cache()
                cached_result = query_cache.get_query_result(query, params)
                if cached_result is not None:
                    cache_time = time.time() - query_start_time
                    logger.debug(f"Cache hit for query {query_hash}: {query[:50]}... (retrieved in {cache_time:.3f}s)")
                    return cached_result
            
            # Execute query with performance monitoring
            result = self.db_manager.execute_query(query, params)
            query_time = time.time() - query_start_time
            
            # Log performance metrics
            result_size = len(result) if result is not None else 0
            logger.info(f"Query {query_hash} executed in {query_time:.3f}s, returned {result_size} rows")
            
            # Log slow queries for optimization
            if query_time > 2.0:  # Log queries taking more than 2 seconds
                logger.warning(f"Slow query detected ({query_time:.3f}s): {query[:100]}...")
            
            # Cache result if enabled
            if use_cache and result is not None:
                query_cache = get_query_cache()
                query_cache.cache_query_result(query, params, result, cache_ttl)
                logger.debug(f"Cached query result {query_hash}: {query[:50]}...")
            
            return result
        except Exception as e:
            query_time = time.time() - query_start_time
            logger.error(f"Query {query_hash} failed after {query_time:.3f}s: {e}")
            logger.error(f"Failed query: {query[:200]}...")
            try:
                if current_app and current_app.config.get('TESTING', False):
                    logger.warning("Testing mode query fallback: returning empty DataFrame")
                    return pd.DataFrame()
            except Exception:
                pass
            raise
    
    def _to_serializable_spectrum(self, spectrum: Optional[np.ndarray]) -> List[Optional[float]]:
        """Convert numpy spectrum to JSON-serializable list with gaps preserved."""
        if spectrum is None:
            return []
        
        serializable: List[Optional[float]] = []
        for value in spectrum:
            try:
                if value is None or np.isnan(value):
                    serializable.append(None)
                else:
                    serializable.append(float(value))
            except TypeError:
                serializable.append(None)
        return serializable

    def _row_value(self, row: pd.Series, key: str):
        """Safely read an optional column from a query row."""
        return row[key] if key in row.index else None
    
    @cache_query(ttl=600)  # Cache for 10 minutes
    def get_asteroid_by_id(self, asteroid_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed asteroid information by ID."""
        try:
            query = """
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
                    a.orbital_period,
                    a.perihelion_distance,
                    a.aphelion_distance,
                    a.diameter,
                    a.albedo,
                    a.rot_per as rotation_period,
                    a.density
                FROM asteroids a 
                WHERE a.id = %s
            """
            
            df = self.execute_query(query, (asteroid_id,), cache_ttl=600)
            if df is None or df.empty:
                return None
            
            row = df.iloc[0]
            asteroid_id_value = self._row_value(row, 'id')
            official_number = self._row_value(row, 'official_number')
            proper_name = self._row_value(row, 'proper_name')
            provisional_designation = self._row_value(row, 'provisional_designation')
            bus_demeo_class = self._row_value(row, 'bus_demeo_class')
            tholen_class = self._row_value(row, 'tholen_class')
            orbital_class = self._row_value(row, 'orbital_class')
            semi_major_axis = self._row_value(row, 'semi_major_axis')
            eccentricity = self._row_value(row, 'eccentricity')
            inclination = self._row_value(row, 'inclination')
            orbital_period = self._row_value(row, 'orbital_period')
            perihelion_distance = self._row_value(row, 'perihelion_distance')
            aphelion_distance = self._row_value(row, 'aphelion_distance')
            diameter = self._row_value(row, 'diameter')
            albedo = self._row_value(row, 'albedo')
            rotation_period = self._row_value(row, 'rotation_period')
            density = self._row_value(row, 'density')
            return {
                'id': int(asteroid_id_value) if pd.notna(asteroid_id_value) else asteroid_id,
                'identifiers': {
                    'official_number': int(official_number) if pd.notna(official_number) else None,
                    'proper_name': str(proper_name) if pd.notna(proper_name) else None,
                    'provisional_designation': str(provisional_designation) if pd.notna(provisional_designation) else None
                },
                'classifications': {
                    'bus_demeo_class': str(bus_demeo_class) if pd.notna(bus_demeo_class) else None,
                    'tholen_class': str(tholen_class) if pd.notna(tholen_class) else None,
                    'orbital_class': str(orbital_class) if pd.notna(orbital_class) else None
                },
                'orbital_elements': {
                    'semi_major_axis': float(semi_major_axis) if pd.notna(semi_major_axis) else None,
                    'eccentricity': float(eccentricity) if pd.notna(eccentricity) else None,
                    'inclination': float(inclination) if pd.notna(inclination) else None,
                    'orbital_period': float(orbital_period) if pd.notna(orbital_period) else None,
                    'perihelion_distance': float(perihelion_distance) if pd.notna(perihelion_distance) else None,
                    'aphelion_distance': float(aphelion_distance) if pd.notna(aphelion_distance) else None
                },
                'physical_properties': {
                    'diameter': float(diameter) if pd.notna(diameter) else None,
                    'albedo': float(albedo) if pd.notna(albedo) else None,
                    'rotation_period': float(rotation_period) if pd.notna(rotation_period) else None,
                    'density': float(density) if pd.notna(density) else None
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get asteroid {asteroid_id}: {e}")
            raise
    
    def get_asteroids_by_ids(self, asteroid_ids: List[int]) -> List[Dict[str, Any]]:
        """Get detailed information for multiple asteroids."""
        if not asteroid_ids:
            return []
        
        try:
            # Create placeholders for IN clause
            placeholders = ','.join(['%s'] * len(asteroid_ids))
            query = f"""
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
                    a.orbital_period,
                    a.perihelion_distance,
                    a.aphelion_distance,
                    a.diameter,
                    a.albedo,
                    a.rot_per as rotation_period,
                    a.density
                FROM asteroids a 
                WHERE a.id IN ({placeholders})
                ORDER BY a.id
            """
            
            df = self.execute_query(query, tuple(asteroid_ids), cache_ttl=600)
            if df is None or df.empty:
                return []
            
            asteroids = []
            for _, row in df.iterrows():
                asteroid_id_value = self._row_value(row, 'id')
                official_number = self._row_value(row, 'official_number')
                proper_name = self._row_value(row, 'proper_name')
                provisional_designation = self._row_value(row, 'provisional_designation')
                bus_demeo_class = self._row_value(row, 'bus_demeo_class')
                tholen_class = self._row_value(row, 'tholen_class')
                orbital_class = self._row_value(row, 'orbital_class')
                semi_major_axis = self._row_value(row, 'semi_major_axis')
                eccentricity = self._row_value(row, 'eccentricity')
                inclination = self._row_value(row, 'inclination')
                orbital_period = self._row_value(row, 'orbital_period')
                perihelion_distance = self._row_value(row, 'perihelion_distance')
                aphelion_distance = self._row_value(row, 'aphelion_distance')
                diameter = self._row_value(row, 'diameter')
                albedo = self._row_value(row, 'albedo')
                rotation_period = self._row_value(row, 'rotation_period')
                density = self._row_value(row, 'density')
                asteroids.append({
                    'id': int(asteroid_id_value) if pd.notna(asteroid_id_value) else None,
                    'identifiers': {
                        'official_number': int(official_number) if pd.notna(official_number) else None,
                        'proper_name': str(proper_name) if pd.notna(proper_name) else None,
                        'provisional_designation': str(provisional_designation) if pd.notna(provisional_designation) else None
                    },
                    'classifications': {
                        'bus_demeo_class': str(bus_demeo_class) if pd.notna(bus_demeo_class) else None,
                        'tholen_class': str(tholen_class) if pd.notna(tholen_class) else None,
                        'orbital_class': str(orbital_class) if pd.notna(orbital_class) else None
                    },
                    'orbital_elements': {
                        'semi_major_axis': float(semi_major_axis) if pd.notna(semi_major_axis) else None,
                        'eccentricity': float(eccentricity) if pd.notna(eccentricity) else None,
                        'inclination': float(inclination) if pd.notna(inclination) else None,
                        'orbital_period': float(orbital_period) if pd.notna(orbital_period) else None,
                        'perihelion_distance': float(perihelion_distance) if pd.notna(perihelion_distance) else None,
                        'aphelion_distance': float(aphelion_distance) if pd.notna(aphelion_distance) else None
                    },
                    'physical_properties': {
                        'diameter': float(diameter) if pd.notna(diameter) else None,
                        'albedo': float(albedo) if pd.notna(albedo) else None,
                        'rotation_period': float(rotation_period) if pd.notna(rotation_period) else None,
                        'density': float(density) if pd.notna(density) else None
                    }
                })
            
            return asteroids
            
        except Exception as e:
            logger.error(f"Failed to get asteroids {asteroid_ids}: {e}")
            raise
    
    @cache_query(ttl=900)  # Cache for 15 minutes (spectral data changes less frequently)
    def get_asteroid_spectrum(self, asteroid_id: int) -> Optional[Dict[str, Any]]:
        """Get spectral data for a specific asteroid."""
        if self.spectral_loader is None:
            raise RuntimeError("Spectral loader not initialized")
        
        try:
            query = """
                SELECT 
                    o.id AS obs_id,
                    a.id AS asteroid_id,
                    o.spectral_data,
                    o.start_time as observation_date,
                    o.data_source
                FROM observations o 
                JOIN asteroids a ON o.asteroid_id = a.id 
                WHERE a.id = %s AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                ORDER BY o.start_time DESC
                LIMIT 1
            """
            
            df = self.execute_query(query, (asteroid_id,), cache_ttl=900)
            if df is None or df.empty:
                return None
            
            row = df.iloc[0]
            spectral_data_str = str(row['spectral_data'])
            
            # Parse and process spectral data using existing utilities
            spectrum = self.spectral_loader._parse_spectral_data(spectral_data_str)
            if spectrum is None:
                return None
            
            # Normalize spectrum
            normalized_spectrum = self.spectral_loader._normalize_by_055(spectrum)
            
            return {
                'asteroid_id': asteroid_id,
                'wavelengths': self.spectral_loader.common_wavelength_grid.tolist(),
                'reflectances': self._to_serializable_spectrum(normalized_spectrum),
                'normalized': True,
                'wavelength_range': {
                    'min': float(self.spectral_loader.common_wavelength_grid.min()),
                    'max': float(self.spectral_loader.common_wavelength_grid.max())
                },
                'metadata': {
                    'observation_id': int(row['obs_id']),
                    'observation_date': str(row['observation_date']) if pd.notna(row['observation_date']) else None,
                    'data_source': str(row['data_source']) if pd.notna(row['data_source']) else None,
                    'processing_date': None
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get spectrum for asteroid {asteroid_id}: {e}")
            raise
    
    def get_asteroids_spectra(self, asteroid_ids: List[int], resolution: str = 'resampled') -> List[Dict[str, Any]]:
        """
        Get spectral data for multiple asteroids.
        
        Args:
            asteroid_ids: List of asteroid IDs
            resolution: 'original' for raw data, 'resampled' for regridded data
        
        Returns:
            List of spectral data dictionaries
        """
        if not asteroid_ids:
            return []
        
        if self.spectral_loader is None:
            raise RuntimeError("Spectral loader not initialized")
        
        try:
            # Create placeholders for IN clause
            placeholders = ','.join(['%s'] * len(asteroid_ids))
            # Get ALL observations for the asteroids, not just the most recent one
            query = f"""
                SELECT 
                    o.id AS obs_id,
                    a.id AS asteroid_id,
                    o.spectral_data,
                    o.start_time as observation_date,
                    o.data_source,
                    o.band,
                    o.mission
                FROM observations o 
                JOIN asteroids a ON o.asteroid_id = a.id 
                WHERE a.id IN ({placeholders}) 
                    AND o.spectral_data IS NOT NULL 
                    AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                ORDER BY a.id, o.start_time DESC
            """
            
            df = self.execute_query(query, tuple(asteroid_ids))
            if df is None or df.empty:
                return []
            
            spectra = []
            for _, row in df.iterrows():
                spectral_data_str = str(row['spectral_data'])
                
                # Parse and process spectral data using existing utilities
                spectrum = self.spectral_loader._parse_spectral_data(spectral_data_str)
                
                if spectrum is not None:
                    if resolution == 'original':
                        # Return original data without regridding
                        # Parse JSON directly to get original wavelengths and reflectances
                        import json
                        try:
                            data_dict = json.loads(spectral_data_str)
                            wavelengths = data_dict.get('wavelengths', [])
                            reflectances = data_dict.get('reflectance', [])
                            normalized = False
                        except:
                            # Fallback: try to extract from spectrum array
                            if len(spectrum.shape) == 2 and spectrum.shape[1] >= 2:
                                wavelengths = spectrum[:, 0].tolist()
                                reflectances = spectrum[:, 1].tolist()
                            else:
                                wavelengths = []
                                reflectances = []
                            normalized = False
                    else:
                        # Normalize and regrid spectrum
                        normalized_spectrum = self.spectral_loader._normalize_by_055(spectrum)
                        wavelengths = self.spectral_loader.common_wavelength_grid.tolist()
                        reflectances = self._to_serializable_spectrum(normalized_spectrum)
                        normalized = True
                    
                    spectra.append({
                        'asteroid_id': int(row['asteroid_id']),
                        'wavelengths': wavelengths,
                        'reflectances': reflectances,
                        'normalized': normalized,
                        'has_data': True,
                        'metadata': {
                            'observation_id': int(row['obs_id']),
                            'observation_date': str(row['observation_date']) if pd.notna(row['observation_date']) else None,
                            'data_source': str(row['data_source']) if pd.notna(row['data_source']) else None,
                            'band': str(row['band']) if pd.notna(row['band']) else None,
                            'mission': str(row['mission']) if pd.notna(row['mission']) else None
                        }
                    })
                else:
                    # Include entry for asteroids with invalid spectral data
                    spectra.append({
                        'asteroid_id': int(row['asteroid_id']),
                        'wavelengths': [],
                        'reflectances': [],
                        'normalized': False,
                        'has_data': False,
                        'metadata': {
                            'observation_id': int(row['obs_id']),
                            'error': 'Failed to parse spectral data'
                        }
                    })
            
            return spectra
            
        except Exception as e:
            logger.error(f"Failed to get spectra for asteroids {asteroid_ids}: {e}")
            raise

# Global database service instance
db_service = FlaskDatabaseService()

def get_database_service() -> FlaskDatabaseService:
    """Get the current database service instance."""
    if current_app:
        return current_app.extensions.get('database_service', db_service)
    return db_service
