#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process..."

# Function to check if docker compose command exists and use appropriate version
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

DOCKER_COMPOSE=$(check_docker_compose)

#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process..."

# Function to check if docker compose command exists and use appropriate version
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

DOCKER_COMPOSE=$(check_docker_compose)

# Build new images without affecting running containers
echo "🏗️  Building new images..."
$DOCKER_COMPOSE build

# If builds succeeded, stop and recreate containers
echo "🔄 Swapping to new containers..."
$DOCKER_COMPOSE down
$DOCKER_COMPOSE up -d --force-recreate

# Check if services are running
echo "🔍 Checking service status..."
sleep 15  # Wait for services to initialize

# Check each service with improved health check logic
check_service() {
    local service=$1
    # Use a simpler approach that works with both docker-compose and docker compose
    local running=$($DOCKER_COMPOSE ps --services --filter "status=running" | grep -w "$service" || true)
    
    if [[ -n "$running" ]]; then
        echo "✅ $service is up and running"
    else
        echo "❌ $service failed to start properly"
        echo "Logs for $service:"
        $DOCKER_COMPOSE logs --tail=50 $service
        exit 1
    fi
}

# Check services
check_service "backend"
check_service "mongodb"

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"