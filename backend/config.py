import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    
    # Database configuration
    DB_HOST = os.environ.get('DB_HOST') or '127.0.0.1'
    DB_PORT = int(os.environ.get('DB_PORT') or 3306)
    DB_NAME = os.environ.get('DB_NAME') or 'asteroid_spectral_db'
    DB_USER = os.environ.get('DB_USER') or 'root'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'bpol68'
    
    # Connection pool settings
    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE') or 10)
    DB_POOL_TIMEOUT = int(os.environ.get('DB_POOL_TIMEOUT') or 30)
    DB_POOL_RECYCLE = int(os.environ.get('DB_POOL_RECYCLE') or 3600)
    
    # CORS configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://127.0.0.1:3000').split(',')
    
    # API configuration
    API_RATE_LIMIT = os.environ.get('API_RATE_LIMIT') or '1000 per hour'
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH') or 16 * 1024 * 1024)  # 16MB
    
    # Cache configuration
    CACHE_TYPE = os.environ.get('CACHE_TYPE') or 'simple'
    CACHE_DEFAULT_TIMEOUT = int(os.environ.get('CACHE_DEFAULT_TIMEOUT') or 300)  # 5 minutes
    
    # Logging configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL') or 'INFO'
    LOG_FILE = os.environ.get('LOG_FILE') or 'logs/asteroid_spectral.log'
    
    # Spectral data configuration
    DEFAULT_WAVELENGTH_RANGE = os.environ.get('DEFAULT_WAVELENGTH_RANGE') or '0.45-2.45'
    SPECTRAL_CACHE_TIMEOUT = int(os.environ.get('SPECTRAL_CACHE_TIMEOUT') or 3600)  # 1 hour
    
    @staticmethod
    def init_app(app):
        """Initialize application with configuration."""
        pass

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False
    
    # More verbose logging in development
    LOG_LEVEL = 'DEBUG'
    
    # Shorter cache timeouts for development
    CACHE_DEFAULT_TIMEOUT = 60  # 1 minute
    SPECTRAL_CACHE_TIMEOUT = 300  # 5 minutes

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    
    # Use in-memory database for testing
    DB_NAME = 'asteroid_spectral_db'
    
    # Disable caching for testing
    CACHE_TYPE = 'null'
    
    # Disable rate limiting for testing
    API_RATE_LIMIT = None

class StagingConfig(Config):
    """Staging configuration."""
    DEBUG = False
    TESTING = False
    
    # Similar to production but with more logging
    LOG_LEVEL = 'INFO'
    API_RATE_LIMIT = os.environ.get('API_RATE_LIMIT') or '750 per hour'
    
    # Enable Redis cache in staging
    CACHE_TYPE = os.environ.get('CACHE_TYPE') or 'redis'

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    
    # Stricter settings for production
    API_RATE_LIMIT = os.environ.get('API_RATE_LIMIT') or '500 per hour'
    
    # Enable Redis cache in production
    CACHE_TYPE = os.environ.get('CACHE_TYPE') or 'redis'
    
    @classmethod
    def init_app(cls, app):
        """Initialize production-specific settings."""
        Config.init_app(app)
        
        # Log to syslog in production
        import logging
        from logging.handlers import SysLogHandler
        syslog_handler = SysLogHandler()
        syslog_handler.setLevel(logging.WARNING)
        app.logger.addHandler(syslog_handler)

config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'staging': StagingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}