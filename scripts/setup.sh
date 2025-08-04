#!/bin/bash
# 3-STEP PLAN:
# 1. Validate macOS environment and hardware specs
# 2. Install dependencies with native optimization for M2/Intel
# 3. Configure development environment for performance-first execution

set -e

echo " ADVANCEPILOT-COPILOT Environment Setup for macOS..."

# Barrier identification: Check hardware constraints
if [[ $(sysctl -n hw.memsize) -lt 8589934592 ]]; then
    echo "⚠️  Warning: Less than 8GB RAM detected - enabling memory optimizations"
    export NODE_OPTIONS="--max-old-space-size=4096"
fi

# Performance-first: Native package installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install via: brew install node"
    exit 1
fi

# Dynamic synergy: Install and optimize dependencies
npm ci --production=false
npx prisma generate
npx prisma db push

# Optimization: Pre-build for faster development
npm run build

echo "✅ Setup complete - optimized for native macOS execution"
echo " Run: npm run dev"
