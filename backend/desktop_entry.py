"""Cross-platform entry point for the desktop application's backend sidecar."""
import os

from waitress import serve

from app import create_app


def main():
    host = '127.0.0.1'
    port = int(os.environ.get('SPECTRAL_BACKEND_PORT', '5000'))
    application = create_app('desktop')
    serve(application, host=host, port=port, threads=6)


if __name__ == '__main__':
    main()
