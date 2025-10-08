#!/bin/bash

# Development Database Setup Script
# Sets up PostgreSQL and Redis via Docker Compose

set -e

echo "🚀 Setting up development databases..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start PostgreSQL and Redis
echo "📦 Starting PostgreSQL and Redis containers..."
docker-compose --profile database up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U realmultillm > /dev/null 2>&1; do
  echo "   Still waiting..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until docker-compose exec -T redis redis-cli --raw incr ping > /dev/null 2>&1; do
  echo "   Still waiting..."
  sleep 1
done

echo "✅ Redis is ready"

# Copy development environment file if .env.local doesn't exist
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from .env.development..."
  cp .env.development .env.local
  echo "⚠️  Please review .env.local and update as needed"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy || npx prisma db push

echo ""
echo "✅ Development environment ready!"
echo ""
echo "📍 Services:"
echo "   PostgreSQL: localhost:5432"
echo "   Redis:      localhost:6379"
echo "   Database:   realmultillm"
echo "   User:       realmultillm"
echo ""
echo "🔑 Credentials (development only):"
echo "   PostgreSQL password: dev_password_change_in_production"
echo "   Redis password:      dev_redis_password"
echo ""
echo "🚀 Start the application:"
echo "   npm run dev"
echo ""
echo "🛑 Stop databases:"
echo "   docker-compose --profile database down"
echo ""
