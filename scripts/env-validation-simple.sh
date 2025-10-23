#!/bin/bash

# Simplified Environment Validation Script for macOS compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ENVIRONMENT VALIDATION (SIMPLIFIED)                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}[SUCCESS]${NC} Node.js $NODE_VERSION installed"
else
    echo -e "${RED}[ERROR]${NC} Node.js not installed"
    exit 1
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}[SUCCESS]${NC} npm $NPM_VERSION installed"
else
    echo -e "${RED}[ERROR]${NC} npm not installed"
    exit 1
fi

# Check if required files exist
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    echo -e "${GREEN}[SUCCESS]${NC} .env.local file exists"
else
    echo -e "${YELLOW}[WARNING]${NC} .env.local file not found"
fi

# Check package.json exists
if [ -f "$PROJECT_ROOT/package.json" ]; then
    echo -e "${GREEN}[SUCCESS]${NC} package.json exists"
else
    echo -e "${RED}[ERROR]${NC} package.json not found"
    exit 1
fi

# Check node_modules exists
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${GREEN}[SUCCESS]${NC} node_modules directory exists"
else
    echo -e "${YELLOW}[WARNING]${NC} node_modules not found - run: npm install"
fi

echo ""
echo -e "${GREEN}✅ Environment validation completed${NC}"
echo ""
echo "To run the full application, use: npm run dev"