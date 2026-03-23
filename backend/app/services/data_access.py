"""
Data access layer for high-level asteroid and spectral data operations.
"""
import logging
import time
from typing import Optional, Dict, Any, List, Tuple
from flask import current_app
import pandas as pd
import numpy as np
from app.utils.cache import (
    cache_query, get_general_cache, get_multi_level_cache,
    get_invalidation_manager, get_warming_service, setup_cache_warming_strategies,
    invalidate_cache_by_data_change
)
from app.utils.query_streaming import QueryStreamer, get_performance_monitor
from .database_service import get_database_service

logger = logging.getLogger(__name__)

class DataAccessLayer:
    """
    High-level data access layer that provides business logic methods
    for asteroid and spectral data operations.
    """
    
    def __init__(self):
        """Initialize the data access layer."""
        self._cached_classifications = None
        self._cached_wavelength_grid = None
        self._multi_level_cache = get_multi_level_cache()
        self._setup_cache_warming()
        self._ensure_band_filter_cache_version()
    
    def _setup_cache_warming(self):
        """Setup cache warming strategies for this data access layer."""
        try:
            setup_cache_warming_strategies()
            logger.info("Cache warming strategies initialized")
        except Exception as e:
            logger.warning(f"Failed to setup cache warming: {e}")

    def _ensure_band_filter_cache_version(self):
        """Ensure cached spectral data reflects current band allowlist."""
        try:
            cache = get_general_cache()
            version_key = "spectral_band_filter_version"
            current_version = "nir-inclusive-v1"
            cached_version = cache.get(version_key)
            if cached_version != current_version:
                invalidate_cache_by_data_change("observations")
                cache.set(version_key, current_version, ttl=86400)
                logger.info("Observations cache invalidated to include NIR spectra")
        except Exception as exc:
            logger.warning(f"Failed to synchronize spectral band cache version: {exc}")
    
    @cache_query(ttl=3600)  # Cache for 1 hour (classification systems rarely change)
    def get_classification_systems(self) -> Dict[str, Any]:
        """
        Get available classification systems and their classes.
        
        Returns:
            Dictionary containing classification systems and their classes
        """
        try:
            db_service = get_database_service()
            
            # Get Bus-DeMeo classes
            bus_demeo_query = """
                SELECT DISTINCT bus_demeo_class 
                FROM asteroids 
                WHERE bus_demeo_class IS NOT NULL 
                ORDER BY bus_demeo_class
            """
            bus_demeo_df = db_service.execute_query(bus_demeo_query, cache_ttl=3600)
            bus_demeo_classes = bus_demeo_df['bus_demeo_class'].tolist() if bus_demeo_df is not None else []
            
            # Get Tholen classes
            tholen_query = """
                SELECT DISTINCT tholen_class 
                FROM asteroids 
                WHERE tholen_class IS NOT NULL 
                ORDER BY tholen_class
            """
            tholen_df = db_service.execute_query(tholen_query, cache_ttl=3600)
            tholen_classes = tholen_df['tholen_class'].tolist() if tholen_df is not None else []
            
            return {
                'systems': [
                    {
                        'name': 'bus_demeo',
                        'display_name': 'Bus-DeMeo',
                        'classes': bus_demeo_classes
                    },
                    {
                        'name': 'tholen',
                        'display_name': 'Tholen',
                        'classes': tholen_classes
                    }
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get classification systems: {e}")
            raise
    
    def get_classification_metadata(self, system: str) -> Dict[str, Any]:
        """
        Get classification metadata (names and counts) without loading asteroid data.
        Optimized for lazy loading scenarios with multi-level caching.
        
        Args:
            system: Classification system ('bus_demeo' or 'tholen')
            
        Returns:
            Dictionary containing classification metadata with counts
        """
        # Check multi-level cache first
        cache_key = f'classification_metadata_{system}'
        cached_result = self._multi_level_cache.get(cache_key)
        if cached_result is not None:
            logger.debug(f"Multi-level cache hit for classification metadata: {system}")
            return cached_result
        
        try:
            db_service = get_database_service()
            
            if system == 'bus_demeo':
                class_column = 'bus_demeo_class'
            elif system == 'tholen':
                class_column = 'tholen_class'
            else:
                raise ValueError(f"Invalid classification system: {system}")
            
            # Optimized query to get counts without loading full asteroid data
            metadata_query = f"""
                SELECT 
                    a.{class_column} as classification,
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN o.spectral_data IS NOT NULL THEN 1 END) as spectral_count
                FROM asteroids a USE INDEX (idx_{class_column})
                LEFT JOIN observations o ON a.id = o.asteroid_id 
                    AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                WHERE a.{class_column} IS NOT NULL
                GROUP BY a.{class_column}
                ORDER BY a.{class_column}
            """
            
            df = db_service.execute_query(metadata_query, cache_ttl=1800)
            if df is None or df.empty:
                return {'classes': [], 'total_asteroids': 0, 'total_with_spectra': 0}
            
            classes = []
            total_asteroids = 0
            total_with_spectra = 0
            
            for _, row in df.iterrows():
                class_name = str(row['classification'])
                total_count = int(row['total_count'])
                spectral_count = int(row['spectral_count'])
                
                classes.append({
                    'name': class_name,
                    'total_count': total_count,
                    'spectral_count': spectral_count,
                    'spectral_percentage': round((spectral_count / total_count * 100), 1) if total_count > 0 else 0
                })
                
                total_asteroids += total_count
                total_with_spectra += spectral_count
            
            result = {
                'system': system,
                'classes': classes,
                'total_asteroids': total_asteroids,
                'total_with_spectra': total_with_spectra,
                'overall_spectral_percentage': round((total_with_spectra / total_asteroids * 100), 1) if total_asteroids > 0 else 0
            }
            
            # Cache in multi-level cache with longer TTL for metadata
            self._multi_level_cache.set(cache_key, result, promote_to_l1=True)
            logger.debug(f"Cached classification metadata for system: {system}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get classification metadata for {system}: {e}")
            raise
    
    def get_asteroids_by_classification(self, system: str, limit: Optional[int] = None, offset: int = 0, 
                                       per_class_limit: Optional[int] = None, stream_results: bool = False) -> Dict[str, Any]:
        """
        Get asteroids grouped by classification system with dynamic pagination and memory management.
        
        Args:
            system: Classification system ('bus_demeo' or 'tholen')
            limit: Maximum total number of asteroids to return (None for unlimited)
            offset: Offset for pagination
            per_class_limit: Maximum number of asteroids per classification class (None for unlimited)
            stream_results: Whether to use streaming for large result sets
            
        Returns:
            Dictionary containing classes and their asteroids with pagination metadata
        """
        try:
            db_service = get_database_service()
            
            if system == 'bus_demeo':
                class_column = 'bus_demeo_class'
            elif system == 'tholen':
                class_column = 'tholen_class'
            else:
                raise ValueError(f"Invalid classification system: {system}")
            
            # First, get total counts for each classification to enable proper pagination
            count_query = f"""
                SELECT 
                    a.{class_column} as classification,
                    COUNT(*) as total_count
                FROM asteroids a
                WHERE a.{class_column} IS NOT NULL
                GROUP BY a.{class_column}
                ORDER BY a.{class_column}
            """
            
            # Use shorter cache for count queries since they're lightweight
            count_df = db_service.execute_query(count_query, cache_ttl=300)
            class_counts = {}
            total_available = 0
            
            if count_df is not None and not count_df.empty:
                for _, row in count_df.iterrows():
                    class_name = str(row['classification'])
                    count = int(row['total_count'])
                    class_counts[class_name] = count
                    total_available += count
            
            # Determine effective limits for memory management
            if limit is None:
                # For unlimited queries, implement safety limits based on available memory
                # Use a reasonable default that can handle large datasets
                effective_limit = min(50000, total_available)  # Cap at 50k for memory safety
            else:
                effective_limit = min(limit, total_available)
            
            # Enhanced multi-level caching strategy with streaming support
            use_cache = not stream_results and effective_limit <= 10000
            cache_key = f"asteroids_by_classification_{system}_{effective_limit}_{offset}_{per_class_limit}"
            
            if use_cache:
                # Try multi-level cache first for better performance
                cached_result = self._multi_level_cache.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Multi-level cache hit for classification query: {system}")
                    return cached_result
                
                # Fallback to general cache for backward compatibility
                cache = get_general_cache()
                cached_result = cache.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"General cache hit for classification query: {system}")
                    # Promote to multi-level cache
                    self._multi_level_cache.set(cache_key, cached_result, promote_to_l1=True)
                    return cached_result
            
            # Build optimized query with proper indexing hints
            if per_class_limit is not None:
                # Use window function for per-class limits with better performance
                query = f"""
                    SELECT 
                        id, official_number, proper_name, provisional_designation, 
                        classification, has_spectral_data
                    FROM (
                        SELECT 
                            a.id,
                            a.official_number,
                            a.proper_name,
                            a.provisional_designation,
                            a.{class_column} as classification,
                            COUNT(o.id) as has_spectral_data,
                            ROW_NUMBER() OVER (
                                PARTITION BY a.{class_column} 
                                ORDER BY a.official_number, a.id
                            ) as class_row_num
                        FROM asteroids a
                        LEFT JOIN observations o ON a.id = o.asteroid_id 
                            AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                        WHERE a.{class_column} IS NOT NULL
                        GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.{class_column}
                    ) ranked
                    WHERE class_row_num <= %s
                    ORDER BY classification, official_number, id
                    LIMIT %s OFFSET %s
                """
                query_params = (per_class_limit, effective_limit, offset)
            else:
                # Standard query with indexing hints for better performance
                query = f"""
                    SELECT 
                        a.id,
                        a.official_number,
                        a.proper_name,
                        a.provisional_designation,
                        a.{class_column} as classification,
                        COUNT(o.id) as has_spectral_data
                    FROM asteroids a
                        LEFT JOIN observations o ON a.id = o.asteroid_id 
                            AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                    WHERE a.{class_column} IS NOT NULL
                    GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.{class_column}
                    ORDER BY a.{class_column}, a.official_number, a.id
                    LIMIT %s OFFSET %s
                """
                query_params = (effective_limit, offset)
            
            # Execute query with performance monitoring and streaming for large datasets
            query_start_time = time.time()
            performance_monitor = get_performance_monitor()
            
            # Log query performance for monitoring
            logger.info(f"Executing classification query: system={system}, limit={effective_limit}, "
                       f"offset={offset}, per_class_limit={per_class_limit}, streaming={stream_results}")
            
            if stream_results or effective_limit > 15000:
                # Use streaming for large datasets to prevent memory issues
                logger.info(f"Using streaming query execution for large dataset (limit={effective_limit})")
                
                streamer = QueryStreamer(db_service, chunk_size=1000)
                chunks = streamer.stream_classification_query(system, effective_limit, offset, per_class_limit)
                
                # Aggregate streamed results
                streaming_result = streamer.aggregate_streamed_results(chunks, 'classification')
                
                query_time = time.time() - query_start_time
                performance_monitor.log_query_performance(
                    f"classification_streaming_{system}", query_time, 
                    streaming_result['total_returned'], "classification_streaming"
                )
                
                # Build result with streaming metadata
                result_classes = streaming_result['classes']
                total_returned = streaming_result['total_returned']
                
                # Add class counts for streaming results
                for cls in result_classes:
                    cls['total_in_class'] = class_counts.get(cls['name'], cls['count'])
                
            else:
                # Use standard query execution for smaller datasets
                cache_ttl = 600 if use_cache else 0  # No cache for large queries
                df = db_service.execute_query(query, query_params, use_cache=use_cache, cache_ttl=cache_ttl)
                
                query_time = time.time() - query_start_time
                result_size = len(df) if df is not None else 0
                performance_monitor.log_query_performance(
                    f"classification_standard_{system}", query_time, result_size, "classification_standard"
                )
                
                logger.info(f"Classification query completed in {query_time:.3f}s, returned {result_size} rows")
                
                if df is None or df.empty:
                    return {
                        'classes': [],
                        'pagination': {
                            'total_available': total_available,
                            'total_returned': 0,
                            'offset': offset,
                            'limit': effective_limit,
                            'has_more': False
                        },
                        'class_counts': class_counts
                    }
                
                # Process results with memory-efficient grouping
                classes = {}
                total_returned = 0
                
                # Use iterrows for memory efficiency with large datasets
                for _, row in df.iterrows():
                    class_name = str(row['classification'])
                    if class_name not in classes:
                        classes[class_name] = []
                    
                    # Determine display name efficiently
                    display_name = self._get_asteroid_display_name(row)
                    
                    classes[class_name].append({
                        'id': int(row['id']),
                        'display_name': display_name,
                        'identifiers': {
                            'official_number': int(row['official_number']) if pd.notna(row['official_number']) else None,
                            'proper_name': str(row['proper_name']) if pd.notna(row['proper_name']) else None,
                            'provisional_designation': str(row['provisional_designation']) if pd.notna(row['provisional_designation']) else None
                        },
                        'has_spectral_data': int(row['has_spectral_data']) > 0
                    })
                    total_returned += 1
                
                # Convert to list format with counts
                result_classes = []
                for class_name, asteroids in classes.items():
                    result_classes.append({
                        'name': class_name,
                        'count': len(asteroids),
                        'total_in_class': class_counts.get(class_name, len(asteroids)),
                        'asteroids': asteroids
                    })
                
                # Sort classes by name
                result_classes.sort(key=lambda x: x['name'])
            

            
            # Calculate pagination metadata
            has_more = (offset + total_returned) < total_available
            
            result = {
                'classes': result_classes,
                'pagination': {
                    'total_available': total_available,
                    'total_returned': total_returned,
                    'offset': offset,
                    'limit': effective_limit,
                    'has_more': has_more,
                    'next_offset': offset + total_returned if has_more else None
                },
                'class_counts': class_counts,
                'memory_optimized': stream_results or effective_limit > 10000
            }
            
            # Cache smaller result sets in multi-level cache
            if use_cache:
                # Cache in both systems for redundancy
                cache = get_general_cache()
                cache.set(cache_key, result, ttl=600)
                
                # Also cache in multi-level cache with intelligent promotion
                promote_to_l1 = effective_limit <= 1000  # Promote smaller datasets to L1
                self._multi_level_cache.set(cache_key, result, promote_to_l1=promote_to_l1)
                
                logger.debug(f"Cached classification result for {system} (L1: {promote_to_l1})")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get asteroids by classification {system}: {e}")
            raise
    
    def _get_asteroid_display_name(self, row) -> str:
        """
        Helper method to determine asteroid display name efficiently.
        
        Args:
            row: DataFrame row containing asteroid data
            
        Returns:
            Formatted display name for the asteroid
        """
        if pd.notna(row['proper_name']) and str(row['proper_name']).strip():
            return str(row['proper_name'])
        elif pd.notna(row['official_number']):
            return f"({int(row['official_number'])})"
        elif pd.notna(row['provisional_designation']) and str(row['provisional_designation']).strip():
            return str(row['provisional_designation'])
        else:
            return f"Asteroid {int(row['id'])}"
    
    def get_asteroid_details(self, asteroid_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed information for a single asteroid.
        
        Args:
            asteroid_id: Asteroid ID
            
        Returns:
            Detailed asteroid information or None if not found
        """
        try:
            db_service = get_database_service()
            return db_service.get_asteroid_by_id(asteroid_id)
            
        except Exception as e:
            logger.error(f"Failed to get asteroid details for {asteroid_id}: {e}")
            raise
    
    def get_asteroids_batch(self, asteroid_ids: List[int]) -> List[Dict[str, Any]]:
        """
        Get detailed information for multiple asteroids.
        
        Args:
            asteroid_ids: List of asteroid IDs
            
        Returns:
            List of detailed asteroid information
        """
        try:
            db_service = get_database_service()
            return db_service.get_asteroids_by_ids(asteroid_ids)
            
        except Exception as e:
            logger.error(f"Failed to get asteroids batch {asteroid_ids}: {e}")
            raise
    
    def get_asteroid_spectrum(self, asteroid_id: int) -> Optional[Dict[str, Any]]:
        """
        Get spectral data for a single asteroid.
        
        Args:
            asteroid_id: Asteroid ID
            
        Returns:
            Spectral data or None if not available
        """
        try:
            db_service = get_database_service()
            return db_service.get_asteroid_spectrum(asteroid_id)
            
        except Exception as e:
            logger.error(f"Failed to get spectrum for asteroid {asteroid_id}: {e}")
            raise
    
    def get_asteroids_spectra_batch(self, asteroid_ids: List[int]) -> List[Dict[str, Any]]:
        """
        Get spectral data for multiple asteroids.
        
        Args:
            asteroid_ids: List of asteroid IDs
            
        Returns:
            List of spectral data
        """
        try:
            db_service = get_database_service()
            return db_service.get_asteroids_spectra(asteroid_ids)
            
        except Exception as e:
            logger.error(f"Failed to get spectra batch for asteroids {asteroid_ids}: {e}")
            raise
    
    def get_single_classification_asteroids(self, system: str, classification_name: str, 
                                          limit: int = 1000, offset: int = 0) -> Dict[str, Any]:
        """
        Get asteroids for a specific classification with pagination.
        
        Args:
            system: Classification system ('bus_demeo' or 'tholen')
            classification_name: Name of the classification (e.g., 'A', 'S', 'C')
            limit: Maximum number of asteroids to return
            offset: Offset for pagination
            
        Returns:
            Dictionary containing asteroids and pagination metadata
        """
        try:
            db_service = get_database_service()
            
            if system == 'bus_demeo':
                class_column = 'bus_demeo_class'
            elif system == 'tholen':
                class_column = 'tholen_class'
            else:
                raise ValueError(f"Invalid classification system: {system}")
            
            # First get total count for this classification
            count_query = f"""
                SELECT COUNT(*) as total_count
                FROM asteroids a
                WHERE a.{class_column} = %s
            """
            
            count_df = db_service.execute_query(count_query, (classification_name,), cache_ttl=300)
            total_count = int(count_df.iloc[0]['total_count']) if count_df is not None and not count_df.empty else 0
            
            if total_count == 0:
                return {
                    'asteroids': [],
                    'pagination': {
                        'total_count': 0,
                        'limit': limit,
                        'offset': offset,
                        'has_more': False,
                        'next_offset': None
                    }
                }
            
            # Get asteroids for this classification
            asteroids_query = f"""
                SELECT 
                    a.id,
                    a.official_number,
                    a.proper_name,
                    a.provisional_designation,
                    a.{class_column} as classification,
                    COUNT(o.id) as has_spectral_data
                FROM asteroids a
                LEFT JOIN observations o ON a.id = o.asteroid_id 
                    AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                WHERE a.{class_column} = %s
                GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.{class_column}
                ORDER BY a.official_number, a.id
                LIMIT %s OFFSET %s
            """
            
            df = db_service.execute_query(asteroids_query, (classification_name, limit, offset), cache_ttl=600)
            
            if df is None or df.empty:
                return {
                    'asteroids': [],
                    'pagination': {
                        'total_count': total_count,
                        'limit': limit,
                        'offset': offset,
                        'has_more': offset < total_count,
                        'next_offset': offset + limit if offset + limit < total_count else None
                    }
                }
            
            # Process results
            asteroids = []
            for _, row in df.iterrows():
                display_name = self._get_asteroid_display_name(row)
                
                asteroids.append({
                    'id': int(row['id']),
                    'display_name': display_name,
                    'identifiers': {
                        'official_number': int(row['official_number']) if pd.notna(row['official_number']) else None,
                        'proper_name': str(row['proper_name']) if pd.notna(row['proper_name']) else None,
                        'provisional_designation': str(row['provisional_designation']) if pd.notna(row['provisional_designation']) else None
                    },
                    'classification': str(row['classification']),
                    'has_spectral_data': int(row['has_spectral_data']) > 0
                })
            
            # Calculate pagination metadata
            returned_count = len(asteroids)
            has_more = (offset + returned_count) < total_count
            next_offset = offset + returned_count if has_more else None
            
            return {
                'asteroids': asteroids,
                'pagination': {
                    'total_count': total_count,
                    'returned_count': returned_count,
                    'limit': limit,
                    'offset': offset,
                    'has_more': has_more,
                    'next_offset': next_offset
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get asteroids for classification {classification_name} in system {system}: {e}")
            raise

    def search_asteroids(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Search asteroids by name, number, or designation.
        
        Args:
            query: Search query string
            limit: Maximum number of results
            
        Returns:
            List of matching asteroids
        """
        try:
            db_service = get_database_service()
            
            # Prepare search query - handle both numeric and text searches
            search_query = f"%{query}%"
            
            sql_query = """
                SELECT 
                    a.id,
                    a.official_number,
                    a.proper_name,
                    a.provisional_designation,
                    a.bus_demeo_class,
                    a.tholen_class,
                    COUNT(o.id) as has_spectral_data
                FROM asteroids a
                LEFT JOIN observations o ON a.id = o.asteroid_id AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                LEFT JOIN observations o ON a.id = o.asteroid_id AND o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
                WHERE 
                    a.proper_name LIKE %s OR
                    a.provisional_designation LIKE %s OR
                    CAST(a.official_number AS CHAR) LIKE %s
                GROUP BY a.id, a.official_number, a.proper_name, a.provisional_designation, a.bus_demeo_class, a.tholen_class
                ORDER BY 
                    CASE 
                        WHEN a.proper_name LIKE %s THEN 1
                        WHEN CAST(a.official_number AS CHAR) LIKE %s THEN 2
                        ELSE 3
                    END,
                    a.official_number,
                    a.id
                LIMIT %s
            """
            
            df = db_service.execute_query(sql_query, (search_query, search_query, search_query, search_query, search_query, limit))
            if df is None or df.empty:
                return []
            
            results = []
            for _, row in df.iterrows():
                # Determine display name
                display_name = None
                if pd.notna(row['proper_name']) and str(row['proper_name']).strip():
                    display_name = str(row['proper_name'])
                elif pd.notna(row['official_number']):
                    display_name = f"({int(row['official_number'])})"
                elif pd.notna(row['provisional_designation']) and str(row['provisional_designation']).strip():
                    display_name = str(row['provisional_designation'])
                else:
                    display_name = f"Asteroid {int(row['id'])}"
                
                results.append({
                    'id': int(row['id']),
                    'display_name': display_name,
                    'identifiers': {
                        'official_number': int(row['official_number']) if pd.notna(row['official_number']) else None,
                        'proper_name': str(row['proper_name']) if pd.notna(row['proper_name']) else None,
                        'provisional_designation': str(row['provisional_designation']) if pd.notna(row['provisional_designation']) else None
                    },
                    'classifications': {
                        'bus_demeo_class': str(row['bus_demeo_class']) if pd.notna(row['bus_demeo_class']) else None,
                        'tholen_class': str(row['tholen_class']) if pd.notna(row['tholen_class']) else None
                    },
                    'has_spectral_data': int(row['has_spectral_data']) > 0
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to search asteroids with query '{query}': {e}")
            raise
    
    def get_wavelength_grid(self) -> np.ndarray:
        """
        Get the common wavelength grid used for spectral data.
        
        Returns:
            Wavelength grid array
        """
        try:
            if self._cached_wavelength_grid is None:
                db_service = get_database_service()
                if db_service.spectral_loader is not None:
                    self._cached_wavelength_grid = db_service.spectral_loader.common_wavelength_grid
                else:
                    # Fallback to default grid
                    self._cached_wavelength_grid = np.arange(0.45, 2.45 + 0.005 * 0.5, 0.005)
            
            return self._cached_wavelength_grid
            
        except Exception as e:
            logger.error(f"Failed to get wavelength grid: {e}")
            raise
    
    def get_database_stats(self) -> Dict[str, Any]:
        """
        Get database statistics for monitoring and debugging.
        
        Returns:
            Dictionary containing database statistics
        """
        try:
            db_service = get_database_service()
            
            # Get asteroid counts
            asteroid_count_query = "SELECT COUNT(*) as total FROM asteroids"
            asteroid_count_df = db_service.execute_query(asteroid_count_query)
            total_asteroids = int(asteroid_count_df.iloc[0]['total']) if asteroid_count_df is not None else 0
            
            # Get asteroids with spectral data count
            spectral_count_query = """
                SELECT COUNT(DISTINCT a.id) as total 
                FROM asteroids a 
                JOIN observations o ON a.id = o.asteroid_id 
                WHERE o.spectral_data IS NOT NULL AND (UPPER(o.band) LIKE 'VNIR%' OR UPPER(o.band) LIKE 'NIR%')
            """
            spectral_count_df = db_service.execute_query(spectral_count_query)
            asteroids_with_spectra = int(spectral_count_df.iloc[0]['total']) if spectral_count_df is not None else 0
            
            # Get classification counts
            bus_demeo_count_query = """
                SELECT bus_demeo_class, COUNT(*) as count 
                FROM asteroids 
                WHERE bus_demeo_class IS NOT NULL 
                GROUP BY bus_demeo_class 
                ORDER BY count DESC
            """
            bus_demeo_df = db_service.execute_query(bus_demeo_count_query)
            bus_demeo_stats = bus_demeo_df.to_dict('records') if bus_demeo_df is not None else []
            
            tholen_count_query = """
                SELECT tholen_class, COUNT(*) as count 
                FROM asteroids 
                WHERE tholen_class IS NOT NULL 
                GROUP BY tholen_class 
                ORDER BY count DESC
            """
            tholen_df = db_service.execute_query(tholen_count_query)
            tholen_stats = tholen_df.to_dict('records') if tholen_df is not None else []
            
            return {
                'total_asteroids': total_asteroids,
                'asteroids_with_spectra': asteroids_with_spectra,
                'spectral_coverage_percent': round((asteroids_with_spectra / total_asteroids * 100), 2) if total_asteroids > 0 else 0,
                'classification_stats': {
                    'bus_demeo': bus_demeo_stats,
                    'tholen': tholen_stats
                },
                'wavelength_grid': {
                    'min': float(self.get_wavelength_grid().min()),
                    'max': float(self.get_wavelength_grid().max()),
                    'resolution': 0.005,
                    'points': len(self.get_wavelength_grid())
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            raise
    
    def validate_data_integrity(self) -> Dict[str, Any]:
        """
        Validate data integrity and return a report.
        
        Returns:
            Dictionary containing validation results
        """
        try:
            db_service = get_database_service()
            issues = []
            
            # Check for asteroids without any classification
            no_classification_query = """
                SELECT COUNT(*) as count 
                FROM asteroids 
                WHERE bus_demeo_class IS NULL AND tholen_class IS NULL
            """
            no_class_df = db_service.execute_query(no_classification_query)
            no_class_count = int(no_class_df.iloc[0]['count']) if no_class_df is not None else 0
            
            if no_class_count > 0:
                issues.append({
                    'type': 'missing_classification',
                    'count': no_class_count,
                    'description': f"{no_class_count} asteroids have no classification data"
                })
            
            # Check for observations without spectral data
            no_spectral_query = """
                SELECT COUNT(*) as count 
                FROM observations 
                WHERE (UPPER(band) LIKE 'VNIR%' OR UPPER(band) LIKE 'NIR%') AND spectral_data IS NULL
            """
            no_spectral_df = db_service.execute_query(no_spectral_query)
            no_spectral_count = int(no_spectral_df.iloc[0]['count']) if no_spectral_df is not None else 0
            
            if no_spectral_count > 0:
                issues.append({
                    'type': 'missing_spectral_data',
                    'count': no_spectral_count,
                    'description': f"{no_spectral_count} VNIR observations have no spectral data"
                })
            
            return {
                'validation_passed': len(issues) == 0,
                'issues_found': len(issues),
                'issues': issues,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to validate data integrity: {e}")
            raise
    
    def warm_cache_for_popular_data(self) -> Dict[str, Any]:
        """
        Warm cache with popular/frequently accessed data.
        
        Returns:
            Dictionary containing warming results
        """
        try:
            warming_results = {}
            
            # Warm classification metadata for both systems
            for system in ['bus_demeo', 'tholen']:
                try:
                    metadata = self.get_classification_metadata(system)
                    warming_results[f'metadata_{system}'] = {
                        'status': 'success',
                        'classes_count': len(metadata.get('classes', []))
                    }
                except Exception as e:
                    warming_results[f'metadata_{system}'] = {
                        'status': 'error',
                        'error': str(e)
                    }
            
            # Warm popular classification queries (small datasets)
            popular_queries = [
                ('bus_demeo', 1000, 0, None),  # First 1000 Bus-DeMeo asteroids
                ('tholen', 1000, 0, None),     # First 1000 Tholen asteroids
            ]
            
            for system, limit, offset, per_class_limit in popular_queries:
                try:
                    result = self.get_asteroids_by_classification(
                        system=system, limit=limit, offset=offset, 
                        per_class_limit=per_class_limit
                    )
                    warming_results[f'classification_{system}_{limit}'] = {
                        'status': 'success',
                        'classes_count': len(result.get('classes', [])),
                        'total_asteroids': result.get('pagination', {}).get('total_returned', 0)
                    }
                except Exception as e:
                    warming_results[f'classification_{system}_{limit}'] = {
                        'status': 'error',
                        'error': str(e)
                    }
            
            # Execute warming service strategies
            warming_service = get_warming_service()
            strategy_results = warming_service.execute_warming_strategies()
            warming_results['strategies'] = strategy_results
            
            return {
                'warming_completed': True,
                'results': warming_results,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to warm cache: {e}")
            return {
                'warming_completed': False,
                'error': str(e),
                'timestamp': time.time()
            }
    
    def get_cache_performance_report(self) -> Dict[str, Any]:
        """
        Get comprehensive cache performance report.
        
        Returns:
            Dictionary containing cache performance metrics and recommendations
        """
        try:
            from app.utils.cache import get_comprehensive_cache_stats
            
            # Get comprehensive cache statistics
            cache_stats = get_comprehensive_cache_stats()
            
            # Add data access layer specific metrics
            cache_stats['data_access_layer'] = {
                'multi_level_cache_enabled': True,
                'cache_warming_enabled': True,
                'invalidation_manager_enabled': True
            }
            
            # Generate performance recommendations
            recommendations = []
            overall_hit_rate = cache_stats['system_overall']['overall_hit_rate']
            
            if overall_hit_rate < 0.6:
                recommendations.append({
                    'type': 'low_hit_rate',
                    'priority': 'high',
                    'message': f'Overall cache hit rate is {overall_hit_rate:.1%}. Consider increasing cache sizes or TTL values.',
                    'suggested_actions': [
                        'Increase L1 cache size',
                        'Extend cache TTL for stable data',
                        'Review cache warming strategies'
                    ]
                })
            
            if cache_stats['multi_level_cache']['l1_cache']['size'] > cache_stats['multi_level_cache']['l1_cache']['max_size'] * 0.9:
                recommendations.append({
                    'type': 'l1_cache_full',
                    'priority': 'medium',
                    'message': 'L1 cache is nearly full. Consider increasing size or optimizing data.',
                    'suggested_actions': [
                        'Increase L1 cache max_size',
                        'Review data promotion strategies',
                        'Clean up cold data'
                    ]
                })
            
            cache_stats['recommendations'] = recommendations
            cache_stats['report_timestamp'] = time.time()
            
            return cache_stats
            
        except Exception as e:
            logger.error(f"Failed to generate cache performance report: {e}")
            return {
                'error': str(e),
                'report_timestamp': time.time()
            }
    
    def invalidate_cache_for_data_update(self, data_type: str) -> Dict[str, Any]:
        """
        Invalidate relevant caches when data is updated.
        
        Args:
            data_type: Type of data that was updated ('asteroids', 'observations', etc.)
            
        Returns:
            Dictionary containing invalidation results
        """
        try:
            from app.utils.cache import invalidate_cache_by_data_change
            
            invalidated_count = invalidate_cache_by_data_change(data_type)
            
            # Also clear local caches if relevant
            if data_type in ['asteroids', 'observations']:
                self._cached_classifications = None
                if data_type == 'observations':
                    self._cached_wavelength_grid = None
            
            return {
                'invalidation_completed': True,
                'data_type': data_type,
                'entries_invalidated': invalidated_count,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to invalidate cache for data update {data_type}: {e}")
            return {
                'invalidation_completed': False,
                'data_type': data_type,
                'error': str(e),
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to invalidate cache for data update {data_type}: {e}")
            return {
                'invalidation_completed': False,
                'data_type': data_type,
                'error': str(e),
                'timestamp': time.time()
            }

# Global data access instance
_data_access_instance = None

def get_data_access() -> DataAccessLayer:
    """Get the global data access layer instance."""
# Global data access instance
_data_access_instance = None

def get_data_access() -> DataAccessLayer:
    """Get the global data access layer instance."""
    global _data_access_instance
    if _data_access_instance is None:
        _data_access_instance = DataAccessLayer()
    return _data_access_instance
