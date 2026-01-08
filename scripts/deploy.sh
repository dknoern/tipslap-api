#!/bin/bash

# Deployment script for Tipslap Backend API
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Environment not specified. Usage: ./deploy.sh [development|staging|production]"
    exit 1
fi

ENVIRONMENT=$1
COMPOSE_FILE=""

# Set compose file based on environment
case $ENVIRONMENT in
    "development")
        COMPOSE_FILE="docker-compose.yml"
        ;;
    "staging")
        COMPOSE_FILE="docker-compose.staging.yml"
        ;;
    "production")
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    *)
        print_error "Invalid environment. Use: development, staging, or production"
        exit 1
        ;;
esac

print_status "Starting deployment for $ENVIRONMENT environment..."

# Check if required files exist
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Docker compose file $COMPOSE_FILE not found!"
    exit 1
fi

if [ ! -f ".env.$ENVIRONMENT" ]; then
    print_error "Environment file .env.$ENVIRONMENT not found!"
    exit 1
fi

# Build and deploy
print_status "Building Docker images..."
docker-compose -f $COMPOSE_FILE build

print_status "Starting services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Run database migrations
print_status "Running database migrations..."
docker-compose -f $COMPOSE_FILE exec tipslap-api npm run db:setup

# Health check
print_status "Performing health check..."
if [ "$ENVIRONMENT" = "development" ]; then
    HEALTH_URL="http://localhost:3000/health/ready"
elif [ "$ENVIRONMENT" = "staging" ]; then
    HEALTH_URL="http://localhost:3001/health/ready"
else
    HEALTH_URL="http://localhost:3000/health/ready"
fi

# Wait for health check to pass
for i in {1..30}; do
    if curl -f $HEALTH_URL > /dev/null 2>&1; then
        print_success "Health check passed!"
        break
    fi
    
    if [ $i -eq 30 ]; then
        print_error "Health check failed after 30 attempts"
        docker-compose -f $COMPOSE_FILE logs tipslap-api
        exit 1
    fi
    
    print_status "Health check attempt $i/30..."
    sleep 2
done

print_success "Deployment completed successfully!"
print_status "Services are running:"
docker-compose -f $COMPOSE_FILE ps

print_status "To view logs: docker-compose -f $COMPOSE_FILE logs -f"
print_status "To stop services: docker-compose -f $COMPOSE_FILE down"