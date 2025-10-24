#!/bin/bash

# Simplified Database Migration Script for macOS compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  DATABASE MIGRATION (SIMPLIFIED)                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}[INFO]${NC} Checking prerequisites..."

# Check if node exists
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed"
    exit 1
fi

# Check if npm exists
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} npm is not installed"
    exit 1
fi

# Check for .env.local
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    echo -e "${YELLOW}[WARNING]${NC} .env.local not found, creating from example..."
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.local"
        echo -e "${YELLOW}[INFO]${NC} Created .env.local from .env.example - please update with your values"
    fi
fi

# Generate Prisma client
echo -e "${BLUE}[INFO]${NC} Generating Prisma client..."
cd "$PROJECT_ROOT"
npx prisma generate

# Run database migrations
echo -e "${BLUE}[INFO]${NC} Running database migrations..."
if [ -f "$PROJECT_ROOT/prisma/schema.prisma" ]; then
    npx prisma db push --force-reset  # Use with caution for dev, not production
    echo -e "${GREEN}[SUCCESS]${NC} Database schema pushed"
else
    echo -e "${YELLOW}[INFO]${NC} No Prisma schema found - skipping migrations"
fi

echo ""
echo -e "${GREEN}✅ Database migration completed${NC}"
echo ""
echo "To start the application, use: npm run dev"