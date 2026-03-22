"""
Export API endpoints for asteroid spectral data.

This module provides REST API endpoints for exporting asteroid and meteorite data
in various formats (CSV, JSON, HDF5, FITS) with customizable field selection
and spectral data options.
"""
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, send_file, current_app
import io
from typing import Dict, Any

from app.services.database_service import get_database_service
from app.services.export_service import ExportService
from app.models.export_models import ExportConfig

export_bp = Blueprint('export', __name__)

# Rate limiting storage (in-memory for simplicity, use Redis in production)
_rate_limit_storage = {}
RATE_LIMIT_REQUESTS = 10
RATE_LIMIT_WINDOW = 60  # seconds


def rate_limit(f):
    """
    Rate limiting decorator for export endpoints.
    
    Limits requests to RATE_LIMIT_REQUESTS per RATE_LIMIT_WINDOW seconds per IP.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get client IP
        client_ip = request.remote_addr
        current_time = datetime.utcnow().timestamp()
        
        # Initialize or get request history for this IP
        if client_ip not in _rate_limit_storage:
            _rate_limit_storage[client_ip] = []
        
        # Clean old requests outside the time window
        _rate_limit_storage[client_ip] = [
            req_time for req_time in _rate_limit_storage[client_ip]
            if current_time - req_time < RATE_LIMIT_WINDOW
        ]
        
        # Check if rate limit exceeded
        if len(_rate_limit_storage[client_ip]) >= RATE_LIMIT_REQUESTS:
            return jsonify({
                'error': 'Rate Limit Exceeded',
                'message': f'Maximum {RATE_LIMIT_REQUESTS} requests per minute allowed. Please try again later.',
                'retry_after': RATE_LIMIT_WINDOW
            }), 429
        
        # Add current request
        _rate_limit_storage[client_ip].append(current_time)
        
        return f(*args, **kwargs)
    
    return decorated_function


def validate_export_request(data: Dict[str, Any]) -> tuple:
    """
    Validate export request data.
    
    Args:
        data: Request data dictionary.
        
    Returns:
        Tuple of (is_valid, error_response)
    """
    # Validate item_ids
    if not data or 'item_ids' not in data:
        return False, jsonify({
            'error': 'Validation Error',
            'message': 'item_ids is required',
            'details': {'field': 'item_ids', 'reason': 'Missing required field'}
        }), 400
    
    item_ids = data.get('item_ids', [])
    if not isinstance(item_ids, list) or len(item_ids) == 0:
        return False, jsonify({
            'error': 'Validation Error',
            'message': 'item_ids must be a non-empty array',
            'details': {'field': 'item_ids', 'reason': 'Must be a non-empty array'}
        }), 400
    
    # Validate item count
    if len(item_ids) > 1000:
        return False, jsonify({
            'error': 'Validation Error',
            'message': f'Maximum 1000 items allowed per export. Requested: {len(item_ids)}',
            'details': {'field': 'item_ids', 'reason': 'Exceeds maximum allowed count', 'max_allowed': 1000}
        }), 400
    
    # Validate format
    format_type = data.get('format', 'csv')
    if format_type not in ['csv', 'json', 'hdf5', 'fits']:
        return False, jsonify({
            'error': 'Validation Error',
            'message': f'Unsupported format: {format_type}',
            'details': {'field': 'format', 'reason': 'Must be one of: csv, json, hdf5, fits'}
        }), 400
    
    return True, None


def get_export_service() -> ExportService:
    """Get or create ExportService instance."""
    db_service = get_database_service()
    return ExportService(db_service)


@export_bp.route('/export/asteroids', methods=['POST'])
@rate_limit
def export_asteroids():
    """
    Export asteroid data in specified format.
    
    Request body:
    {
        "item_ids": ["ast_123", "ast_456"],
        "format": "csv" | "json" | "hdf5" | "fits",
        "include_fields": {
            "basic_info": true,
            "classification": true,
            "orbital_params": true,
            "physical_props": true,
            "spectral_data": true
        },
        "spectral_options": {
            "wavelength_range": [0.45, 2.45],
            "resolution": "original",
            "include_uncertainty": true,
            "include_metadata": true
        }
    }
    
    Returns:
        File download with appropriate Content-Type and Content-Disposition headers.
    """
    try:
        data = request.get_json()
        
        # Validate request
        is_valid, error_response = validate_export_request(data)
        if not is_valid:
            return error_response
        
        # Create export configuration
        try:
            config = ExportConfig.from_dict({
                **data,
                'data_type': 'asteroids'
            })
            config.validate()
        except ValueError as e:
            return jsonify({
                'error': 'Validation Error',
                'message': str(e),
                'details': {'reason': 'Invalid export configuration'}
            }), 400
        
        # Get export service and perform export
        export_service = get_export_service()
        result = export_service.export_data(config)
        
        # Create file response
        file_stream = io.BytesIO(result.content)
        file_stream.seek(0)
        
        return send_file(
            file_stream,
            mimetype=result.mime_type,
            as_attachment=True,
            download_name=result.filename
        )
        
    except ValueError as e:
        current_app.logger.warning(f'Validation error in asteroid export: {e}')
        return jsonify({
            'error': 'Validation Error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Asteroid export error: {e}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'Failed to export asteroid data. Please try again later.',
            'details': {'error': str(e)}
        }), 500

@export_bp.route('/export/meteorites', methods=['POST'])
@rate_limit
def export_meteorites():
    """
    Export meteorite data in specified format.
    
    Request body: Same structure as /export/asteroids
    
    Returns:
        File download with appropriate Content-Type and Content-Disposition headers.
    """
    try:
        data = request.get_json()
        
        # Validate request
        is_valid, error_response = validate_export_request(data)
        if not is_valid:
            return error_response
        
        # Create export configuration
        try:
            config = ExportConfig.from_dict({
                **data,
                'data_type': 'meteorites'
            })
            config.validate()
        except ValueError as e:
            return jsonify({
                'error': 'Validation Error',
                'message': str(e),
                'details': {'reason': 'Invalid export configuration'}
            }), 400
        
        # Get export service and perform export
        export_service = get_export_service()
        result = export_service.export_data(config)
        
        # Create file response
        file_stream = io.BytesIO(result.content)
        file_stream.seek(0)
        
        return send_file(
            file_stream,
            mimetype=result.mime_type,
            as_attachment=True,
            download_name=result.filename
        )
        
    except ValueError as e:
        current_app.logger.warning(f'Validation error in meteorite export: {e}')
        return jsonify({
            'error': 'Validation Error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Meteorite export error: {e}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'Failed to export meteorite data. Please try again later.',
            'details': {'error': str(e)}
        }), 500


@export_bp.route('/export/preview', methods=['POST'])
@rate_limit
def preview_export():
    """
    Preview export data structure without downloading.
    
    Request body: Same structure as export endpoints
    
    Returns:
        JSON preview with data structure, sample data, and size estimation.
    """
    try:
        data = request.get_json()
        
        # Validate request
        is_valid, error_response = validate_export_request(data)
        if not is_valid:
            return error_response
        
        # Determine data type from request or default to asteroids
        data_type = data.get('data_type', 'asteroids')
        
        # Create export configuration
        try:
            config = ExportConfig.from_dict({
                **data,
                'data_type': data_type
            })
            config.validate()
        except ValueError as e:
            return jsonify({
                'error': 'Validation Error',
                'message': str(e),
                'details': {'reason': 'Invalid export configuration'}
            }), 400
        
        # Get export service and generate preview
        export_service = get_export_service()
        preview = export_service.preview_export(config)
        
        return jsonify(preview), 200
        
    except ValueError as e:
        current_app.logger.warning(f'Validation error in export preview: {e}')
        return jsonify({
            'error': 'Validation Error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Export preview error: {e}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'Failed to generate export preview. Please try again later.',
            'details': {'error': str(e)}
        }), 500


@export_bp.route('/export/estimate-size', methods=['POST'])
@rate_limit
def estimate_export_size():
    """
    Estimate export file size without performing the export.
    
    Request body: Same structure as export endpoints
    
    Returns:
        JSON with size estimation in bytes and human-readable format.
    """
    try:
        data = request.get_json()
        
        # Validate request
        is_valid, error_response = validate_export_request(data)
        if not is_valid:
            return error_response
        
        # Determine data type from request or default to asteroids
        data_type = data.get('data_type', 'asteroids')
        
        # Create export configuration
        try:
            config = ExportConfig.from_dict({
                **data,
                'data_type': data_type
            })
            config.validate()
        except ValueError as e:
            return jsonify({
                'error': 'Validation Error',
                'message': str(e),
                'details': {'reason': 'Invalid export configuration'}
            }), 400
        
        # Get export service and estimate size
        export_service = get_export_service()
        size_bytes = export_service.estimate_size(config)
        
        # Format size for human readability
        size_human = _format_size(size_bytes)
        
        return jsonify({
            'estimated_size_bytes': size_bytes,
            'estimated_size_human': size_human,
            'item_count': len(config.item_ids),
            'includes_spectral_data': config.include_fields.spectral_data,
            'format': config.format
        }), 200
        
    except ValueError as e:
        current_app.logger.warning(f'Validation error in size estimation: {e}')
        return jsonify({
            'error': 'Validation Error',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Size estimation error: {e}', exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'Failed to estimate export size. Please try again later.',
            'details': {'error': str(e)}
        }), 500


def _format_size(size_bytes: int) -> str:
    """
    Format size in bytes to human-readable string.
    
    Args:
        size_bytes: Size in bytes.
        
    Returns:
        Human-readable size string.
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"