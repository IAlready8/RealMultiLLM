#!/bin/bash

# RealMultiLLM Docker Setup Script
# This script provides OPTIONAL Docker deployment
# The project runs natively without Docker - this is just an alternative

set -e

echo "🐳 RealMultiLLM Docker Setup (Optional)"
echo "======================================="
echo ""
echo "⚠️  NOTE: This project runs natively without Docker!"
echo "    Use this script only if you prefer containerized deployment."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first or use native deployment."
    echo "   For native deployment, run: npm run native:setup"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available."
    echo "   Please install Docker Compose or use: npm run docker:build && npm run docker:run"
    exit 1
fi

# Copy environment file if it doesn't exist
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        echo "📄 Copying .env.example to .env.local..."
        cp .env.example .env.local
        echo "✅ Please edit .env.local with your configuration"
    else
        echo "❌ No .env.example found. Please create .env.local manually."
        exit 1
    fi
fi

echo ""
echo "🏗️  Building Docker images..."
docker-compose build

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "✅ Docker deployment complete!"
echo ""
echo "🌐 Application available at: http://localhost:3000"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker-compose logs -f app"
echo "   Stop services: docker-compose down"
echo "   Restart:       docker-compose restart"
echo ""
echo "💡 For native deployment (recommended), use:"
echo "   npm run native:setup"
echo "   npm run native:dev"
echo ""