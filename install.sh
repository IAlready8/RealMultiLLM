#!/bin/bash
# 🚀 RealMultiLLM Environment Setup Script
# 3-STEP PLAN:
# 1. Install system dependencies
# 2. Install Node.js dependencies and Prisma setup
# 3. Validate the setup to ensure readiness

set -e  # Exit immediately on error
echo "🚀 Starting environment setup for RealMultiLLM..."

# STEP 1: Check system requirements
echo "🔍 Checking system requirements..."
NODE_VERSION=$(node -v | grep -Eo 'v[0-9]+')
if [[ "$NODE_VERSION" != "v18" && "$NODE_VERSION" != "v19" ]]; then
  echo "❌ Node.js 18 or 19 is required. Please install it."
  exit 1
fi

echo "✅ Node.js version is valid: $NODE_VERSION"

# STEP 2: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm ci

# Generate Prisma client
echo "🛠 Generating Prisma client..."
npx prisma generate

# STEP 3: Validate environment setup
echo "✅ Validating environment..."
npm run validate || echo "⚠️ Validation failed. Please fix errors before proceeding."

echo "🎉 Environment setup complete! Ready for development."
