#!/bin/bash
# Database Setup Script for RealMultiLLM
# Sets up PostgreSQL database and runs Prisma migrations

set -e

echo "🔧 RealMultiLLM Database Setup"
echo "================================"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Copying from .env.example..."
    cp .env.example .env.local
    echo "✓ Created .env.local - please configure DATABASE_URL"
    exit 1
fi

# Load environment variables
source .env.local 2>/dev/null || true

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env.local"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    exit 1
fi

echo "✓ Environment configuration loaded"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma client
echo "🔨 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🚀 Running database migrations..."
npx prisma migrate deploy

# Seed database (optional)
if [ -f "prisma/seed.ts" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development server: npm run dev"
echo "  2. View database: npx prisma studio"
