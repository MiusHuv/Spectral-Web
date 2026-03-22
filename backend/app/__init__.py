"""
Flask application package initialization.
"""
import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_restful import Api
from config import config

def create_app(config_name=None):
    """Create and configure Flask application."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize CORS with flexible configuration
    # Allow ngrok domains and localhost
    cors_config = {
        'origins': ['*'],  # Allow all origins for development
        'methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allow_headers': ['Content-Type', 'Authorization', 'X-Requested-With'],
        'expose_headers': ['Content-Range', 'X-Content-Range', 'Content-Disposition'],
        'supports_credentials': True,
        'max_age': 3600
    }
    CORS(app, **cors_config)
    
    # Initialize Flask-RESTful
    api = Api(app, catch_all_404s=True)
    
    # Initialize caching
    initialize_cache(app)
    
    # Initialize database service
    initialize_database_service(app)
    
    # Configure logging
    configure_logging(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Root endpoint
    @app.route('/')
    def root():
        return jsonify({
            'service': 'Asteroid Spectral Visualization API',
            'version': '1.0.0',
            'status': 'running',
            'endpoints': {
                'health': '/health',
                'api': {
                    'classifications': '/api/classifications',
                    'asteroids': '/api/asteroids',
                    'spectral': '/api/spectral',
                    'export': '/api/export',
                    'cache': '/api/cache'
                }
            },
            'documentation': 'Visit /api/ endpoints for data access'
        })
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({'status': 'healthy', 'service': 'asteroid-spectral-api'})
    
    return app

def configure_logging(app):
    """Configure application logging."""
    if not app.debug and not app.testing:
        # Production logging configuration
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = logging.FileHandler('logs/asteroid_spectral.log')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Asteroid Spectral API startup')

def register_error_handlers(app):
    """Register enhanced error handlers."""
    from app.utils.error_handlers import register_error_handlers as register_enhanced_handlers
    register_enhanced_handlers(app)

def initialize_cache(app):
    """Initialize caching for the application."""
    from flask_caching import Cache
    
    try:
        cache = Cache(app)
        app.extensions['cache'] = cache
        app.logger.info('Cache initialized successfully')
    except Exception as e:
        app.logger.error(f'Failed to initialize cache: {e}')
        raise

def initialize_database_service(app):
    """Initialize database service with Flask app."""
    from app.services.database_service import get_database_service
    
    try:
        db_service = get_database_service()
        db_service.init_app(app)
        app.logger.info('Database service initialized successfully')
    except Exception as e:
        app.logger.error(f'Failed to initialize database service: {e}')
        raise

def register_blueprints(app):
    """Register application blueprints."""
    # Import and register API blueprints
    from app.api.classifications import classifications_bp
    from app.api.asteroids import asteroids_bp
    from app.api.asteroids_real import asteroids_real_bp
    from app.api.spectral import spectral_bp
    from app.api.export import export_bp
    from app.api.cache import cache_bp
    from app.api.meteorites import meteorites_bp
    
    app.register_blueprint(classifications_bp, url_prefix='/api')
    app.register_blueprint(asteroids_bp, url_prefix='/api')
    app.register_blueprint(asteroids_real_bp, url_prefix='/api/v2')  # New real API
    app.register_blueprint(spectral_bp, url_prefix='/api')
    app.register_blueprint(export_bp, url_prefix='/api')
    app.register_blueprint(cache_bp, url_prefix='/api')
    app.register_blueprint(meteorites_bp, url_prefix='/api')