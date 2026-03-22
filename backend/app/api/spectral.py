"""
Spectral data API endpoints for asteroid spectral curve retrieval.
"""
from flask import Blueprint, jsonify, request, current_app
from flask_restful import Resource, Api
from app.services.data_access import get_data_access
import time

spectral_bp = Blueprint('spectral', __name__)
api = Api(spectral_bp)

def get_cache():
    """Get the cache instance from the current app."""
    try:
        return current_app.extensions.get('cache')
    except (RuntimeError, AttributeError):
        # Return None if no app context or cache not available
        return None

class AsteroidSpectrum(Resource):
    """Get spectral data for a specific asteroid."""
    
    def get(self, asteroid_id):
        """Return processed spectral data for an asteroid."""
        try:
            # Validate asteroid_id parameter
            try:
                asteroid_id = int(asteroid_id)
            except ValueError:
                return {
                    'error': 'Invalid asteroid ID',
                    'message': 'Asteroid ID must be a valid integer',
                    'status': 'error'
                }, 400
            
            if asteroid_id <= 0:
                return {
                    'error': 'Invalid asteroid ID',
                    'message': 'Asteroid ID must be positive',
                    'status': 'error'
                }, 400
            
            # Get optional parameters
            normalized = request.args.get('normalized', 'true').lower() == 'true'
            wavelength_range = request.args.get('wavelength_range', '0.45-2.45')
            
            # Validate wavelength range
            try:
                if '-' in wavelength_range:
                    min_wl, max_wl = map(float, wavelength_range.split('-'))
                    if min_wl >= max_wl or min_wl < 0.3 or max_wl > 3.0:
                        raise ValueError()
                else:
                    raise ValueError()
            except ValueError:
                return {
                    'error': 'Invalid wavelength range',
                    'message': 'Wavelength range must be in format "min-max" (e.g., "0.45-2.45")',
                    'status': 'error'
                }, 400
            
            # Check cache first
            cache = get_cache()
            cache_key = f"spectrum_{asteroid_id}_{normalized}_{wavelength_range}"
            if cache and hasattr(cache, 'get'):
                try:
                    cached_result = cache.get(cache_key)
                    if cached_result:
                        current_app.logger.debug(f'Returning cached spectrum for asteroid {asteroid_id}')
                        return cached_result
                except Exception as e:
                    current_app.logger.debug(f'Cache get failed: {e}')
            
            # Get spectral data from data access layer
            data_access = get_data_access()
            spectral_data = data_access.get_asteroid_spectrum(asteroid_id)
            
            if spectral_data is None:
                return {
                    'error': 'Spectral data not found',
                    'message': f'No spectral data available for asteroid {asteroid_id}',
                    'status': 'error'
                }, 404
            
            # Filter wavelength range if requested
            if wavelength_range != '0.45-2.45':
                wavelengths = spectral_data['wavelengths']
                reflectances = spectral_data['reflectances']
                
                # Find indices within the requested range
                filtered_indices = [
                    i for i, wl in enumerate(wavelengths) 
                    if min_wl <= wl <= max_wl
                ]
                
                if filtered_indices:
                    spectral_data['wavelengths'] = [wavelengths[i] for i in filtered_indices]
                    spectral_data['reflectances'] = [reflectances[i] for i in filtered_indices]
                    spectral_data['wavelength_range'] = {'min': min_wl, 'max': max_wl}
                else:
                    # No data in requested range
                    spectral_data['wavelengths'] = []
                    spectral_data['reflectances'] = []
                    spectral_data['wavelength_range'] = {'min': min_wl, 'max': max_wl}
            
            # Add processing timestamp
            spectral_data['metadata']['processing_date'] = time.strftime('%Y-%m-%d %H:%M:%S')
            
            result = {
                'spectrum': spectral_data,
                'status': 'success'
            }
            
            # Cache the result
            if cache and hasattr(cache, 'set'):
                try:
                    cache.set(cache_key, result, timeout=current_app.config.get('SPECTRAL_CACHE_TIMEOUT', 300))
                except Exception as e:
                    current_app.logger.debug(f'Cache set failed: {e}')
            
            return result, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching spectrum for asteroid {asteroid_id}: {e}')
            return {
                'error': 'Failed to fetch spectral data',
                'message': str(e),
                'status': 'error'
            }, 500

class SpectraBatch(Resource):
    """Get spectral data for multiple asteroids."""
    
    def post(self):
        """Return spectral data for multiple asteroids."""
        try:
            # Validate request data
            if not request.is_json:
                return {
                    'error': 'Invalid request format',
                    'message': 'Request must be JSON',
                    'status': 'error'
                }, 400
            
            data = request.get_json(force=True, silent=True)
            if data is None:
                return {
                    'error': 'Invalid request format',
                    'message': 'Request must be valid JSON',
                    'status': 'error'
                }, 400
            if not data or 'asteroid_ids' not in data:
                return {
                    'error': 'Missing required field',
                    'message': 'Request must include asteroid_ids array',
                    'status': 'error'
                }, 400
            
            asteroid_ids = data['asteroid_ids']
            if not isinstance(asteroid_ids, list):
                return {
                    'error': 'Invalid asteroid_ids format',
                    'message': 'asteroid_ids must be an array',
                    'status': 'error'
                }, 400
            
            if len(asteroid_ids) == 0:
                return {
                    'error': 'Empty asteroid_ids',
                    'message': 'At least one asteroid ID must be provided',
                    'status': 'error'
                }, 400
            
            if len(asteroid_ids) > 50:
                return {
                    'error': 'Too many asteroid IDs',
                    'message': 'Maximum 50 asteroids can be requested at once for spectral data',
                    'status': 'error'
                }, 400
            
            # Validate individual asteroid IDs
            validated_ids = []
            for aid in asteroid_ids:
                try:
                    aid = int(aid)
                    if aid <= 0:
                        raise ValueError()
                    validated_ids.append(aid)
                except (ValueError, TypeError):
                    return {
                        'error': 'Invalid asteroid ID',
                        'message': f'All asteroid IDs must be positive integers: {aid}',
                        'status': 'error'
                    }, 400
            
            # Get optional parameters
            normalized = data.get('normalized', True)
            wavelength_range = data.get('wavelength_range', '0.45-2.45')
            
            # Validate wavelength range
            min_wl, max_wl = 0.45, 2.45
            if wavelength_range != '0.45-2.45':
                try:
                    if '-' in wavelength_range:
                        min_wl, max_wl = map(float, wavelength_range.split('-'))
                        if min_wl >= max_wl or min_wl < 0.3 or max_wl > 3.0:
                            raise ValueError()
                    else:
                        raise ValueError()
                except ValueError:
                    return {
                        'error': 'Invalid wavelength range',
                        'message': 'Wavelength range must be in format "min-max" (e.g., "0.45-2.45")',
                        'status': 'error'
                    }, 400
            
            # Check cache for batch request
            cache = get_cache()
            cache_key = f"spectra_batch_{hash(tuple(sorted(validated_ids)))}_{normalized}_{wavelength_range}"
            if cache and hasattr(cache, 'get'):
                try:
                    cached_result = cache.get(cache_key)
                    if cached_result:
                        current_app.logger.debug(f'Returning cached batch spectra for {len(validated_ids)} asteroids')
                        return cached_result
                except Exception as e:
                    current_app.logger.debug(f'Cache get failed: {e}')
            
            # Get spectral data from data access layer
            data_access = get_data_access()
            spectra_data = data_access.get_asteroids_spectra_batch(validated_ids)
            
            # Process and filter spectral data
            processed_spectra = []
            for spectrum in spectra_data:
                if spectrum.get('has_data', False) and spectrum.get('wavelengths'):
                    # Filter wavelength range if requested
                    if wavelength_range != '0.45-2.45':
                        wavelengths = spectrum['wavelengths']
                        reflectances = spectrum['reflectances']
                        
                        # Find indices within the requested range
                        filtered_indices = [
                            i for i, wl in enumerate(wavelengths) 
                            if min_wl <= wl <= max_wl
                        ]
                        
                        if filtered_indices:
                            spectrum['wavelengths'] = [wavelengths[i] for i in filtered_indices]
                            spectrum['reflectances'] = [reflectances[i] for i in filtered_indices]
                        else:
                            # No data in requested range
                            spectrum['wavelengths'] = []
                            spectrum['reflectances'] = []
                            spectrum['has_data'] = False
                    
                    # Add processing timestamp
                    if 'metadata' not in spectrum:
                        spectrum['metadata'] = {}
                    spectrum['metadata']['processing_date'] = time.strftime('%Y-%m-%d %H:%M:%S')
                
                processed_spectra.append(spectrum)
            
            # Add entries for asteroids without spectral data
            found_ids = {s['asteroid_id'] for s in processed_spectra}
            for aid in validated_ids:
                if aid not in found_ids:
                    processed_spectra.append({
                        'asteroid_id': aid,
                        'wavelengths': [],
                        'reflectances': [],
                        'normalized': normalized,
                        'has_data': False,
                        'metadata': {
                            'error': 'No spectral data available',
                            'processing_date': time.strftime('%Y-%m-%d %H:%M:%S')
                        }
                    })
            
            # Sort by asteroid_id for consistent ordering
            processed_spectra.sort(key=lambda x: x['asteroid_id'])
            
            result = {
                'spectra': processed_spectra,
                'requested_count': len(validated_ids),
                'returned_count': len(processed_spectra),
                'spectra_with_data': len([s for s in processed_spectra if s.get('has_data', False)]),
                'parameters': {
                    'normalized': normalized,
                    'wavelength_range': wavelength_range
                },
                'status': 'success'
            }
            
            # Cache the result
            if cache and hasattr(cache, 'set'):
                try:
                    cache.set(cache_key, result, timeout=current_app.config.get('SPECTRAL_CACHE_TIMEOUT', 300))
                except Exception as e:
                    current_app.logger.debug(f'Cache set failed: {e}')
            
            return result, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching batch spectra: {e}')
            return {
                'error': 'Failed to fetch spectral data',
                'message': str(e),
                'status': 'error'
            }, 500

class WavelengthGrid(Resource):
    """Get the common wavelength grid used for spectral data."""
    
    def get(self):
        """Return the wavelength grid information."""
        try:
            # Get optional parameters
            wavelength_range = request.args.get('wavelength_range', '0.45-2.45')
            
            # Validate wavelength range
            min_wl, max_wl = 0.45, 2.45
            if wavelength_range != '0.45-2.45':
                try:
                    if '-' in wavelength_range:
                        min_wl, max_wl = map(float, wavelength_range.split('-'))
                        if min_wl >= max_wl or min_wl < 0.3 or max_wl > 3.0:
                            raise ValueError()
                    else:
                        raise ValueError()
                except ValueError:
                    return {
                        'error': 'Invalid wavelength range',
                        'message': 'Wavelength range must be in format "min-max" (e.g., "0.45-2.45")',
                        'status': 'error'
                    }, 400
            
            # Check cache first
            cache = get_cache()
            cache_key = f"wavelength_grid_{wavelength_range}"
            if cache and hasattr(cache, 'get'):
                try:
                    cached_result = cache.get(cache_key)
                    if cached_result:
                        return cached_result
                except Exception as e:
                    current_app.logger.debug(f'Cache get failed: {e}')
            
            # Get wavelength grid from data access layer
            data_access = get_data_access()
            full_wavelength_grid = data_access.get_wavelength_grid()
            
            # Filter to requested range if needed
            if wavelength_range != '0.45-2.45':
                filtered_wavelengths = [
                    wl for wl in full_wavelength_grid 
                    if min_wl <= wl <= max_wl
                ]
            else:
                filtered_wavelengths = full_wavelength_grid.tolist()
            
            result = {
                'wavelengths': filtered_wavelengths,
                'count': len(filtered_wavelengths),
                'range': {
                    'min': float(min(filtered_wavelengths)) if filtered_wavelengths else min_wl,
                    'max': float(max(filtered_wavelengths)) if filtered_wavelengths else max_wl,
                    'requested_min': min_wl,
                    'requested_max': max_wl
                },
                'resolution': 0.005,
                'units': 'micrometers',
                'status': 'success'
            }
            
            # Cache the result for longer since wavelength grid rarely changes
            if cache and hasattr(cache, 'set'):
                try:
                    cache.set(cache_key, result, timeout=3600)  # Cache for 1 hour
                except Exception as e:
                    current_app.logger.debug(f'Cache set failed: {e}')
            
            return result, 200
            
        except Exception as e:
            current_app.logger.error(f'Error fetching wavelength grid: {e}')
            return {
                'error': 'Failed to fetch wavelength grid',
                'message': str(e),
                'status': 'error'
            }, 500

# Register resources with API
api.add_resource(AsteroidSpectrum, '/asteroids/<asteroid_id>/spectrum')
api.add_resource(SpectraBatch, '/spectra/batch')
api.add_resource(WavelengthGrid, '/spectra/wavelength-grid')