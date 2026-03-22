"""
Data retrieval service for export functionality.

This service handles retrieving data from the database based on export
configuration, including metadata and spectral data.
"""
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import json
import logging
import hashlib
from datetime import datetime, timedelta
from functools import lru_cache

from app.services.database_service import FlaskDatabaseService
from app.models.export_models import IncludeFields, SpectralOptions

logger = logging.getLogger(__name__)


class DataRetrievalService:
    """Service for retrieving data from database for export operations."""
    
    # Cache configuration
    CACHE_EXPIRATION_MINUTES = 30
    MAX_CACHE_SIZE = 100  # Maximum number of cached entries
    
    def __init__(self, db_service: FlaskDatabaseService):
        """
        Initialize data retrieval service.
        
        Args:
            db_service: Database service instance for data access.
        """
        self.db_service = db_service
        # Initialize cache for spectral data
        self._spectral_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
    
    def get_asteroid_data(
        self,
        asteroid_ids: List[str],
        include_fields: IncludeFields,
        spectral_options: Optional[SpectralOptions] = None
    ) -> pd.DataFrame:
        """
        Retrieve asteroid data with specified fields.
        
        Args:
            asteroid_ids: List of asteroid IDs to retrieve.
            include_fields: Configuration for which fields to include.
            spectral_options: Optional spectral data configuration.
            
        Returns:
            DataFrame containing asteroid data.
        """
        if not asteroid_ids:
            return pd.DataFrame()
        
        try:
            logger.info(f"Retrieving asteroid data for {len(asteroid_ids)} items")
            logger.debug(f"Asteroid IDs: {asteroid_ids[:5]}..." if len(asteroid_ids) > 5 else f"Asteroid IDs: {asteroid_ids}")
            
            # Build field list based on configuration
            fields = self._build_asteroid_field_list(include_fields)
            logger.debug(f"Selected fields: {fields}")
            
            # Build query with JOIN to observations if spectral data is needed
            if include_fields.spectral_data and spectral_options:
                query = self._build_asteroid_query_with_spectral(asteroid_ids, fields)
            else:
                query = self._build_asteroid_query(asteroid_ids, fields)
            
            logger.debug(f"Executing query: {query[:200]}...")
            
            # Execute query with parameters
            df = self.db_service.execute_query(query, tuple(asteroid_ids), use_cache=False)
            
            if df is None:
                logger.error("Database query returned None")
                return pd.DataFrame()
            
            if df.empty:
                logger.warning(f"No asteroid data found for IDs: {asteroid_ids}")
                return pd.DataFrame()
            
            logger.info(f"Successfully retrieved {len(df)} asteroid records")
            return df
        
        except Exception as e:
            logger.error(f"Error retrieving asteroid data: {e}", exc_info=True)
            raise
    
    def get_meteorite_data(
        self,
        meteorite_ids: List[str],
        include_fields: IncludeFields,
        spectral_options: Optional[SpectralOptions] = None
    ) -> pd.DataFrame:
        """
        Retrieve meteorite data with specified fields.
        
        Args:
            meteorite_ids: List of meteorite IDs to retrieve.
            include_fields: Configuration for which fields to include.
            spectral_options: Optional spectral data configuration.
            
        Returns:
            DataFrame containing meteorite data.
        """
        if not meteorite_ids:
            logger.warning("get_meteorite_data called with empty meteorite_ids list")
            return pd.DataFrame()
        
        try:
            logger.info(f"Retrieving meteorite data for {len(meteorite_ids)} items")
            logger.debug(f"Meteorite IDs: {meteorite_ids[:5]}..." if len(meteorite_ids) > 5 else f"Meteorite IDs: {meteorite_ids}")
            
            # Strip 'meteorite-' prefix if present (frontend sends IDs with prefix)
            clean_ids = []
            for mid in meteorite_ids:
                if isinstance(mid, str) and mid.startswith('meteorite-'):
                    clean_ids.append(mid.replace('meteorite-', ''))
                else:
                    clean_ids.append(str(mid))
            
            logger.debug(f"Cleaned meteorite IDs: {clean_ids[:5]}..." if len(clean_ids) > 5 else f"Cleaned meteorite IDs: {clean_ids}")
            
            # Build field list based on configuration
            fields = self._build_meteorite_field_list(include_fields)
            logger.debug(f"Selected fields: {fields}")
            
            # Build and execute query
            query = self._build_meteorite_query(clean_ids, fields, spectral_options)
            logger.debug(f"Executing query: {query[:200]}...")
            
            # Execute query
            df = self.db_service.execute_query(query, tuple(clean_ids), use_cache=False)
            
            if df is None:
                logger.error("Database query returned None")
                return pd.DataFrame()
            
            if df.empty:
                logger.warning(f"No meteorite data found for IDs: {clean_ids}")
                return pd.DataFrame()
            
            logger.info(f"Successfully retrieved {len(df)} meteorite records")
            return df
        
        except Exception as e:
            logger.error(f"Error retrieving meteorite data: {e}", exc_info=True)
            raise
    
    def get_spectral_data(
        self,
        item_ids: List[str],
        data_type: str,
        options: SpectralOptions
    ) -> Dict[str, Any]:
        """
        Retrieve spectral data arrays with caching support.
        
        Args:
            item_ids: List of item IDs to retrieve spectral data for.
            data_type: Type of data ('asteroids' or 'meteorites').
            options: Spectral data options.
            
        Returns:
            Dictionary containing spectral data arrays:
            - 'wavelengths': 1D array of wavelength values
            - 'reflectance': 2D array of reflectance values (items x wavelengths)
            - 'uncertainty': 2D array of uncertainty values (if available)
            - 'item_ids': List of item IDs corresponding to rows
            - 'metadata': List of observation metadata dicts
        """
        if not item_ids:
            return {
                'wavelengths': np.array([]),
                'reflectance': np.array([]).reshape(0, 0),
                'uncertainty': None,
                'item_ids': [],
                'metadata': []
            }
        
        try:
            # Check cache for each item
            cached_items = []
            uncached_ids = []
            
            for item_id in item_ids:
                cache_key = self._generate_cache_key(item_id, data_type, options)
                cached_data = self._get_from_cache(cache_key)
                
                if cached_data is not None:
                    cached_items.append((item_id, cached_data))
                    logger.debug(f"Cache hit for item {item_id}")
                else:
                    uncached_ids.append(item_id)
            
            # Retrieve uncached data
            if uncached_ids:
                if data_type == 'asteroids':
                    uncached_data = self._get_asteroid_spectral_data(uncached_ids, options)
                elif data_type == 'meteorites':
                    uncached_data = self._get_meteorite_spectral_data(uncached_ids, options)
                else:
                    raise ValueError(f"Invalid data_type: {data_type}")
                
                # Cache individual items
                self._cache_spectral_data(uncached_ids, uncached_data, data_type, options)
            else:
                # All items were cached
                uncached_data = {
                    'wavelengths': np.array([]),
                    'reflectance': np.array([]).reshape(0, 0),
                    'uncertainty': None,
                    'item_ids': [],
                    'metadata': []
                }
            
            # Combine cached and uncached data
            if cached_items:
                combined_data = self._combine_spectral_data(cached_items, uncached_data)
                return combined_data
            else:
                return uncached_data
        
        except Exception as e:
            logger.error(f"Error retrieving spectral data: {e}")
            raise
    
    def _generate_cache_key(
        self,
        item_id: str,
        data_type: str,
        options: SpectralOptions
    ) -> str:
        """
        Generate cache key for spectral data.
        
        Args:
            item_id: Item identifier.
            data_type: Type of data.
            options: Spectral options.
            
        Returns:
            Cache key string.
        """
        # Create a unique key based on item ID, data type, and options
        key_parts = [
            item_id,
            data_type,
            str(options.wavelength_range) if options.wavelength_range else 'full',
            options.resolution,
            str(options.include_uncertainty),
            str(options.include_metadata)
        ]
        key_string = '|'.join(key_parts)
        
        # Use hash for shorter keys
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve data from cache if available and not expired.
        
        Args:
            cache_key: Cache key.
            
        Returns:
            Cached data or None if not found or expired.
        """
        if cache_key not in self._spectral_cache:
            return None
        
        # Check if cache entry has expired
        timestamp = self._cache_timestamps.get(cache_key)
        if timestamp:
            age = datetime.utcnow() - timestamp
            if age > timedelta(minutes=self.CACHE_EXPIRATION_MINUTES):
                # Cache expired, remove it
                del self._spectral_cache[cache_key]
                del self._cache_timestamps[cache_key]
                logger.debug(f"Cache expired for key {cache_key}")
                return None
        
        return self._spectral_cache[cache_key]
    
    def _cache_spectral_data(
        self,
        item_ids: List[str],
        spectral_data: Dict[str, Any],
        data_type: str,
        options: SpectralOptions
    ) -> None:
        """
        Cache spectral data for individual items.
        
        Args:
            item_ids: List of item IDs.
            spectral_data: Spectral data dictionary.
            data_type: Type of data.
            options: Spectral options.
        """
        # Clean up old cache entries if cache is too large
        if len(self._spectral_cache) >= self.MAX_CACHE_SIZE:
            self._cleanup_old_cache_entries()
        
        # Cache each item individually
        wavelengths = spectral_data.get('wavelengths', np.array([]))
        reflectance = spectral_data.get('reflectance', np.array([]))
        uncertainty = spectral_data.get('uncertainty')
        metadata_list = spectral_data.get('metadata', [])
        returned_ids = spectral_data.get('item_ids', [])
        
        for idx, item_id in enumerate(returned_ids):
            if item_id in item_ids:
                cache_key = self._generate_cache_key(item_id, data_type, options)
                
                # Store individual item data
                cached_item = {
                    'wavelengths': wavelengths.copy(),
                    'reflectance': reflectance[idx].copy() if len(reflectance) > idx else np.array([]),
                    'uncertainty': uncertainty[idx].copy() if uncertainty is not None and len(uncertainty) > idx else None,
                    'metadata': metadata_list[idx] if metadata_list and len(metadata_list) > idx else None
                }
                
                self._spectral_cache[cache_key] = cached_item
                self._cache_timestamps[cache_key] = datetime.utcnow()
                logger.debug(f"Cached spectral data for item {item_id}")
    
    def _cleanup_old_cache_entries(self) -> None:
        """Remove oldest cache entries to maintain cache size limit."""
        if not self._cache_timestamps:
            return
        
        # Sort by timestamp and remove oldest 20%
        sorted_keys = sorted(
            self._cache_timestamps.items(),
            key=lambda x: x[1]
        )
        
        num_to_remove = max(1, len(sorted_keys) // 5)
        
        for cache_key, _ in sorted_keys[:num_to_remove]:
            if cache_key in self._spectral_cache:
                del self._spectral_cache[cache_key]
            if cache_key in self._cache_timestamps:
                del self._cache_timestamps[cache_key]
        
        logger.debug(f"Cleaned up {num_to_remove} old cache entries")
    
    def _combine_spectral_data(
        self,
        cached_items: List[tuple],
        uncached_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Combine cached and uncached spectral data.
        
        Args:
            cached_items: List of (item_id, cached_data) tuples.
            uncached_data: Dictionary of uncached spectral data.
            
        Returns:
            Combined spectral data dictionary.
        """
        # Extract wavelengths (should be same for all)
        wavelengths = None
        if cached_items:
            wavelengths = cached_items[0][1]['wavelengths']
        elif len(uncached_data.get('wavelengths', [])) > 0:
            wavelengths = uncached_data['wavelengths']
        else:
            wavelengths = np.array([])
        
        # Combine reflectance data
        reflectance_list = []
        item_ids_list = []
        metadata_list = []
        uncertainty_list = []
        has_uncertainty = False
        
        # Add cached items
        for item_id, cached_data in cached_items:
            reflectance_list.append(cached_data['reflectance'])
            item_ids_list.append(item_id)
            if cached_data.get('metadata'):
                metadata_list.append(cached_data['metadata'])
            if cached_data.get('uncertainty') is not None:
                uncertainty_list.append(cached_data['uncertainty'])
                has_uncertainty = True
        
        # Add uncached items
        uncached_reflectance = uncached_data.get('reflectance', np.array([]))
        uncached_ids = uncached_data.get('item_ids', [])
        uncached_metadata = uncached_data.get('metadata', [])
        uncached_uncertainty = uncached_data.get('uncertainty')
        
        for idx, item_id in enumerate(uncached_ids):
            if len(uncached_reflectance) > idx:
                reflectance_list.append(uncached_reflectance[idx])
                item_ids_list.append(item_id)
                if uncached_metadata and len(uncached_metadata) > idx:
                    metadata_list.append(uncached_metadata[idx])
                if uncached_uncertainty is not None and len(uncached_uncertainty) > idx:
                    uncertainty_list.append(uncached_uncertainty[idx])
                    has_uncertainty = True
        
        # Convert to arrays
        reflectance_array = np.array(reflectance_list) if reflectance_list else np.array([]).reshape(0, len(wavelengths))
        uncertainty_array = np.array(uncertainty_list) if has_uncertainty and uncertainty_list else None
        
        return {
            'wavelengths': wavelengths,
            'reflectance': reflectance_array,
            'uncertainty': uncertainty_array,
            'item_ids': item_ids_list,
            'metadata': metadata_list if metadata_list else None
        }
    
    def _get_asteroid_spectral_data(
        self,
        asteroid_ids: List[str],
        options: SpectralOptions
    ) -> Dict[str, Any]:
        """Retrieve spectral data for asteroids."""
        # Convert string IDs to integers
        int_ids = [int(id_str) for id_str in asteroid_ids]
        
        # Get spectral data using existing database service method
        # Pass resolution option to get original or resampled data
        spectra_list = self.db_service.get_asteroids_spectra(int_ids, resolution=options.resolution)
        
        if not spectra_list:
            return {
                'wavelengths': np.array([]),
                'reflectance': np.array([]).reshape(0, 0),
                'uncertainty': None,
                'item_ids': [],
                'metadata': []
            }
        
        # Check if using original resolution (each observation has its own wavelength grid)
        if options.resolution == 'original':
            # For original data, store wavelengths per observation
            wavelengths_list = []
            reflectance_list = []
            valid_ids = []
            metadata_list = []
            
            for spectrum in spectra_list:
                if spectrum.get('has_data', False):
                    wl = np.array(spectrum['wavelengths'])
                    refl = np.array(spectrum['reflectances'])
                    
                    # Apply wavelength range filter if specified
                    if options.wavelength_range and len(wl) > 0:
                        min_wl, max_wl = options.wavelength_range
                        mask = (wl >= min_wl) & (wl <= max_wl)
                        wl = wl[mask]
                        refl = refl[mask]
                    
                    if len(refl) > 0:
                        wavelengths_list.append(wl)
                        reflectance_list.append(refl)
                        valid_ids.append(str(spectrum['asteroid_id']))
                        
                        # Add metadata if requested
                        if options.include_metadata:
                            metadata_list.append({
                                'item_id': str(spectrum['asteroid_id']),
                                'observation_id': spectrum['metadata'].get('observation_id'),
                                'observation_date': spectrum['metadata'].get('observation_date'),
                                'data_source': spectrum['metadata'].get('data_source'),
                                'band': spectrum['metadata'].get('band'),
                                'mission': spectrum['metadata'].get('mission')
                            })
            
            # For original data, return list of arrays (not a 2D matrix)
            result = {
                'wavelengths': wavelengths_list,  # List of arrays
                'reflectance': reflectance_list,   # List of arrays
                'uncertainty': None,
                'item_ids': valid_ids,
                'metadata': metadata_list if metadata_list else None,
                'resolution': 'original'
            }
        else:
            # For resampled data, all observations share the same wavelength grid
            wavelengths = np.array(spectra_list[0]['wavelengths']) if spectra_list else np.array([])
            
            # Apply wavelength range filter if specified
            if options.wavelength_range:
                min_wl, max_wl = options.wavelength_range
                mask = (wavelengths >= min_wl) & (wavelengths <= max_wl)
                wavelengths = wavelengths[mask]
            else:
                mask = np.ones(len(wavelengths), dtype=bool)
            
            # Build reflectance matrix
            reflectance_list = []
            valid_ids = []
            metadata_list = []
            
            for spectrum in spectra_list:
                if spectrum.get('has_data', False):
                    reflectances = np.array(spectrum['reflectances'])
                    
                    # Apply wavelength mask
                    if len(reflectances) > 0:
                        reflectances = reflectances[mask]
                        reflectance_list.append(reflectances)
                        valid_ids.append(str(spectrum['asteroid_id']))
                        
                        # Add metadata if requested
                        if options.include_metadata:
                            metadata_list.append({
                                'item_id': str(spectrum['asteroid_id']),
                                'observation_id': spectrum['metadata'].get('observation_id'),
                                'observation_date': spectrum['metadata'].get('observation_date'),
                                'data_source': spectrum['metadata'].get('data_source'),
                                'band': spectrum['metadata'].get('band'),
                                'mission': spectrum['metadata'].get('mission')
                            })
            
            # Convert to 2D array
            if reflectance_list:
                reflectance_array = np.array(reflectance_list)
            else:
                reflectance_array = np.array([]).reshape(0, len(wavelengths))
            
            result = {
                'wavelengths': wavelengths,
            'reflectance': reflectance_array,
            'uncertainty': None,  # Not available in current schema
            'item_ids': valid_ids,
            'metadata': metadata_list if options.include_metadata else None
        }
        
        return result
    
    def _get_meteorite_spectral_data(
        self,
        meteorite_ids: List[str],
        options: SpectralOptions
    ) -> Dict[str, Any]:
        """Retrieve spectral data for meteorites."""
        # Strip 'meteorite-' prefix if present (frontend sends IDs with prefix)
        clean_ids = []
        for mid in meteorite_ids:
            if isinstance(mid, str) and mid.startswith('meteorite-'):
                clean_ids.append(mid.replace('meteorite-', ''))
            else:
                clean_ids.append(str(mid))
        
        logger.debug(f"Cleaned meteorite IDs for spectral data: {clean_ids[:5]}..." if len(clean_ids) > 5 else f"Cleaned meteorite IDs: {clean_ids}")
        
        # Build query to get spectral data
        placeholders = ','.join(['%s'] * len(clean_ids))
        query = f"""
            SELECT 
                id,
                specimen_name,
                spectral_data
            FROM meteorites
            WHERE id IN ({placeholders}) AND spectral_data IS NOT NULL
            ORDER BY id
        """
        
        df = self.db_service.execute_query(query, tuple(clean_ids), use_cache=False)
        
        if df is None or df.empty:
            return {
                'wavelengths': np.array([]),
                'reflectance': np.array([]).reshape(0, 0),
                'uncertainty': None,
                'item_ids': [],
                'metadata': []
            }
        
        # Parse spectral data
        wavelengths = None
        reflectance_list = []
        valid_ids = []
        metadata_list = []
        
        for _, row in df.iterrows():
            try:
                # Parse JSON spectral data
                if isinstance(row['spectral_data'], str):
                    spectral_data = json.loads(row['spectral_data'])
                else:
                    spectral_data = row['spectral_data']
                
                if spectral_data and 'wavelength' in spectral_data and 'reflectance' in spectral_data:
                    wl = np.array(spectral_data['wavelength'])
                    refl = np.array(spectral_data['reflectance'])
                    
                    # Filter out invalid data points
                    valid_mask = (wl > 0) & (refl >= 0) & ~np.isnan(wl) & ~np.isnan(refl)
                    wl = wl[valid_mask]
                    refl = refl[valid_mask]
                    
                    if len(wl) > 0:
                        # Set wavelengths from first valid spectrum
                        if wavelengths is None:
                            wavelengths = wl
                            
                            # Apply wavelength range filter if specified
                            if options.wavelength_range:
                                min_wl, max_wl = options.wavelength_range
                                wl_mask = (wavelengths >= min_wl) & (wavelengths <= max_wl)
                                wavelengths = wavelengths[wl_mask]
                        
                        # Interpolate to common wavelength grid if needed
                        if not np.array_equal(wl, wavelengths):
                            refl = np.interp(wavelengths, wl, refl, left=np.nan, right=np.nan)
                        elif options.wavelength_range:
                            # Apply wavelength mask
                            min_wl, max_wl = options.wavelength_range
                            wl_mask = (wl >= min_wl) & (wl <= max_wl)
                            refl = refl[wl_mask]
                        
                        reflectance_list.append(refl)
                        valid_ids.append(str(row['id']))
                        
                        # Add metadata if requested
                        if options.include_metadata:
                            metadata_list.append({
                                'item_id': str(row['id']),
                                'specimen_name': row['specimen_name'],
                                'observation_date': None,  # Not available in current schema
                                'data_source': 'RELAB',  # Assumed source
                                'instrument': None,
                                'mission': None
                            })
            
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"Failed to parse spectral data for meteorite {row['id']}: {e}")
                continue
        
        # Set default wavelengths if none found
        if wavelengths is None:
            wavelengths = np.array([])
        
        # Convert to 2D array
        if reflectance_list:
            reflectance_array = np.array(reflectance_list)
        else:
            reflectance_array = np.array([]).reshape(0, len(wavelengths))
        
        result = {
            'wavelengths': wavelengths,
            'reflectance': reflectance_array,
            'uncertainty': None,  # Not available in current schema
            'item_ids': valid_ids,
            'metadata': metadata_list if options.include_metadata else None
        }
        
        return result
    
    def _build_asteroid_field_list(self, include_fields: IncludeFields) -> List[str]:
        """
        Build list of database fields to retrieve for asteroids.
        
        Args:
            include_fields: Field inclusion configuration.
            
        Returns:
            List of field names to retrieve.
        """
        fields = []
        
        # Always include ID
        fields.append('a.id')
        
        if include_fields.basic_info:
            fields.extend([
                'a.official_number',
                'a.proper_name',
                'a.provisional_designation'
            ])
        
        if include_fields.classification:
            fields.extend([
                'a.bus_demeo_class',
                'a.tholen_class',
                'a.orbital_class'
            ])
        
        if include_fields.orbital_params:
            fields.extend([
                'a.semi_major_axis',
                'a.eccentricity',
                'a.inclination',
                'a.orbital_period',
                'a.perihelion_distance',
                'a.aphelion_distance'
            ])
        
        if include_fields.physical_props:
            fields.extend([
                'a.diameter',
                'a.albedo',
                'a.rot_per as rotation_period',
                'a.density'
            ])
        
        return fields
    
    def _build_meteorite_field_list(self, include_fields: IncludeFields) -> List[str]:
        """
        Build list of database fields to retrieve for meteorites.
        
        Args:
            include_fields: Field inclusion configuration.
            
        Returns:
            List of field names to retrieve.
        """
        fields = []
        
        # Always include ID
        fields.append('id')
        
        if include_fields.basic_info:
            # Check which fields actually exist in the meteorites table
            fields.extend([
                'specimen_name',
            ])
        
        if include_fields.classification:
            fields.extend([
                'main_label',
                'sub_label',
                'sub_sub_label'
            ])
        
        # Note: meteorite table doesn't have mass, density, grain_size in current schema
        # Only include spectral_data if needed
        if include_fields.spectral_data:
            fields.append('spectral_data')
        
        logger.debug(f"Built meteorite field list: {fields}")
        return fields
    
    def _build_asteroid_query(
        self,
        asteroid_ids: List[str],
        fields: List[str]
    ) -> str:
        """
        Build SQL query for asteroid data retrieval (without spectral data).
        
        Args:
            asteroid_ids: List of asteroid IDs.
            fields: List of fields to retrieve.
            
        Returns:
            SQL query string.
        """
        field_list = ', '.join(fields)
        placeholders = ','.join(['%s'] * len(asteroid_ids))
        
        query = f"""
            SELECT {field_list}
            FROM asteroids a
            WHERE a.id IN ({placeholders})
            ORDER BY a.id
        """
        
        return query
    
    def _build_asteroid_query_with_spectral(
        self,
        asteroid_ids: List[str],
        fields: List[str]
    ) -> str:
        """
        Build SQL query for asteroid data retrieval with JOIN to observations.
        
        Args:
            asteroid_ids: List of asteroid IDs.
            fields: List of fields to retrieve.
            
        Returns:
            SQL query string.
        """
        # Add observation fields
        obs_fields = [
            'o.id as observation_id',
            'o.spectral_data',
            'o.start_time as observation_date',
            'o.data_source'
        ]
        
        all_fields = fields + obs_fields
        field_list = ', '.join(all_fields)
        placeholders = ','.join(['%s'] * len(asteroid_ids))
        
        # Use subquery to get only the most recent observation per asteroid
        query = f"""
            SELECT {field_list}
            FROM asteroids a
            LEFT JOIN (
                SELECT 
                    asteroid_id,
                    id,
                    spectral_data,
                    start_time,
                    data_source,
                    ROW_NUMBER() OVER (PARTITION BY asteroid_id ORDER BY start_time DESC) as rn
                FROM observations
                WHERE spectral_data IS NOT NULL 
                AND (UPPER(band) LIKE 'VNIR%' OR UPPER(band) LIKE 'NIR%')
            ) o ON a.id = o.asteroid_id AND o.rn = 1
            WHERE a.id IN ({placeholders})
            ORDER BY a.id
        """
        
        return query
    
    def _build_meteorite_query(
        self,
        meteorite_ids: List[str],
        fields: List[str],
        spectral_options: Optional[SpectralOptions]
    ) -> str:
        """
        Build SQL query for meteorite data retrieval.
        
        Args:
            meteorite_ids: List of meteorite IDs.
            fields: List of fields to retrieve.
            spectral_options: Optional spectral data options.
            
        Returns:
            SQL query string.
        """
        field_list = ', '.join(fields)
        placeholders = ','.join(['%s'] * len(meteorite_ids))
        
        query = f"""
            SELECT {field_list}
            FROM meteorites
            WHERE id IN ({placeholders})
            ORDER BY id
        """
        
        return query
    
    def clear_cache(self) -> None:
        """Clear all cached spectral data."""
        self._spectral_cache.clear()
        self._cache_timestamps.clear()
        logger.info("Spectral data cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics.
        """
        return {
            'size': len(self._spectral_cache),
            'max_size': self.MAX_CACHE_SIZE,
            'expiration_minutes': self.CACHE_EXPIRATION_MINUTES,
            'oldest_entry_age_minutes': self._get_oldest_entry_age()
        }
    
    def _get_oldest_entry_age(self) -> Optional[float]:
        """Get age of oldest cache entry in minutes."""
        if not self._cache_timestamps:
            return None
        
        oldest_timestamp = min(self._cache_timestamps.values())
        age = datetime.utcnow() - oldest_timestamp
        return age.total_seconds() / 60
