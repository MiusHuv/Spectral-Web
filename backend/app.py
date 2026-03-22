"""
Flask application entry point for asteroid spectral visualization web app.
"""
from app import create_app

if __name__ == '__main__':
    application = create_app()
    application.run(host='0.0.0.0', port=5000, debug=True)