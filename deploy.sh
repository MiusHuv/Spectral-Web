#!/bin/bash

# Asteroid Spectral Web App Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Environment: development, staging, production
# Action: build, deploy, restart, logs

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="asteroid-spectral-app"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Default values
ENVIRONMENT=${1:-staging}
ACTION=${2:-deploy}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        development|staging|production)
            log_info "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_error "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        exit 1
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        log_error "pip3 is not installed"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build frontend
build_frontend() {
    log_info "Building frontend for $ENVIRONMENT..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    npm ci
    
    # Run tests
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Running frontend tests..."
        npm run test -- --run
    fi
    
    # Build for environment
    case $ENVIRONMENT in
        production)
            npm run build:prod
            ;;
        staging)
            npm run build:staging
            ;;
        *)
            npm run build
            ;;
    esac
    
    log_info "Frontend build completed"
}

# Setup backend
setup_backend() {
    log_info "Setting up backend for $ENVIRONMENT..."
    
    cd "$BACKEND_DIR"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Run tests
    if [ "$ENVIRONMENT" != "development" ]; then
        log_info "Running backend tests..."
        python -m pytest tests/ -v
    fi
    
    log_info "Backend setup completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application..."
    
    case $ENVIRONMENT in
        development)
            deploy_development
            ;;
        staging|production)
            deploy_production_like
            ;;
    esac
}

# Development deployment
deploy_development() {
    log_info "Starting development servers..."
    
    # Start backend in background
    cd "$BACKEND_DIR"
    source venv/bin/activate
    export FLASK_ENV=development
    python app.py &
    BACKEND_PID=$!
    
    # Start frontend in background
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    
    log_info "Development servers started"
    log_info "Frontend: http://localhost:3000"
    log_info "Backend: http://localhost:5000"
    log_info "Press Ctrl+C to stop servers"
    
    # Wait for interrupt
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    wait
}

# Production-like deployment (staging/production)
deploy_production_like() {
    log_info "Deploying to $ENVIRONMENT environment..."
    
    # Copy environment file
    if [ -f "$BACKEND_DIR/.env.$ENVIRONMENT" ]; then
        cp "$BACKEND_DIR/.env.$ENVIRONMENT" "$BACKEND_DIR/.env"
        log_info "Environment file copied"
    else
        log_warn "No environment file found for $ENVIRONMENT"
    fi
    
    # Start backend with Gunicorn
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Create logs directory
    mkdir -p logs
    
    # Start Gunicorn
    export FLASK_ENV=$ENVIRONMENT
    gunicorn --config gunicorn.conf.py wsgi:application &
    GUNICORN_PID=$!
    
    log_info "Backend started with Gunicorn (PID: $GUNICORN_PID)"
    
    # For production, you would typically serve frontend with nginx
    # For this script, we'll use a simple HTTP server
    cd "$FRONTEND_DIR"
    if [ -d "dist" ]; then
        python3 -m http.server 8080 --directory dist &
        FRONTEND_PID=$!
        log_info "Frontend served on http://localhost:8080 (PID: $FRONTEND_PID)"
    else
        log_error "Frontend build not found. Run build first."
        kill $GUNICORN_PID 2>/dev/null
        exit 1
    fi
    
    log_info "Application deployed successfully"
    log_info "Frontend: http://localhost:8080"
    log_info "Backend: http://localhost:5000"
    
    # Save PIDs for later management
    echo $GUNICORN_PID > /tmp/asteroid-spectral-backend.pid
    echo $FRONTEND_PID > /tmp/asteroid-spectral-frontend.pid
}

# Restart application
restart_application() {
    log_info "Restarting application..."
    
    # Stop existing processes
    if [ -f "/tmp/asteroid-spectral-backend.pid" ]; then
        BACKEND_PID=$(cat /tmp/asteroid-spectral-backend.pid)
        kill $BACKEND_PID 2>/dev/null || true
        rm -f /tmp/asteroid-spectral-backend.pid
    fi
    
    if [ -f "/tmp/asteroid-spectral-frontend.pid" ]; then
        FRONTEND_PID=$(cat /tmp/asteroid-spectral-frontend.pid)
        kill $FRONTEND_PID 2>/dev/null || true
        rm -f /tmp/asteroid-spectral-frontend.pid
    fi
    
    # Redeploy
    deploy_application
}

# Show logs
show_logs() {
    log_info "Showing application logs..."
    
    if [ -f "$BACKEND_DIR/logs/asteroid_spectral.log" ]; then
        log_info "Backend logs:"
        tail -f "$BACKEND_DIR/logs/asteroid_spectral.log"
    else
        log_warn "No backend logs found"
    fi
}

# Main execution
main() {
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    
    validate_environment
    
    case $ACTION in
        build)
            check_prerequisites
            build_frontend
            setup_backend
            ;;
        deploy)
            check_prerequisites
            build_frontend
            setup_backend
            deploy_application
            ;;
        restart)
            restart_application
            ;;
        logs)
            show_logs
            ;;
        *)
            log_error "Invalid action: $ACTION"
            log_error "Valid actions: build, deploy, restart, logs"
            exit 1
            ;;
    esac
    
    log_info "Deployment process completed"
}

# Run main function
main "$@"