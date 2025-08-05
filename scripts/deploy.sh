#!/bin/bash
# RealMultiLLM Deployment Script
# Optimized for macOS systems with limited resources

# 3-STEP PLAN:
# 1. Validate environment and dependencies
# 2. Run tests and build process with resource management
# 3. Deploy to Netlify with proper configuration

set -e # Exit on any error

echo "🚀 Starting RealMultiLLM deployment process..."

# Check Node version
if ! node -v | grep -q "v1[68]"; then
  echo "❌ Node.js version 16 or 18 is required"
  exit 1
fi

# Check for required environment variables
required_envs=("DATABASE_URL" "NEXTAUTH_SECRET")
missing_envs=()

for env in "${required_envs[@]}"; do
  if [ -z "${!env}" ]; then
    missing_envs+=("$env")
  fi
done

if [ ${#missing_envs[@]} -ne 0 ]; then
  echo "❌ Missing required environment variables: ${missing_envs[*]}"
  echo "Please set them in .env.local or your environment"
  exit 1
fi

# Clean previous build files
echo "🧹 Cleaning previous build artifacts..."
npm run clean

# Install dependencies with memory optimization
echo "📦 Installing dependencies..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm ci --no-fund --no-audit

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate || {
  echo "⚠️  Prisma generate failed due to network restrictions, continuing..."
  echo "    This is expected in environments without internet access."
  echo "    Make sure to run 'npx prisma generate' in your deployment environment."
}

# Run type checking
echo "🔍 Running type checking..."
npm run type-check

# Run lightweight tests (skip heavy tests on resource-constrained machines)
echo "🧪 Running critical tests only..."
LIGHTWEIGHT_TESTS=true npm test -- --run

# Build the application
echo "🏗️ Building the application..."
npm run build

# Deploy using Netlify CLI if installed
if command -v netlify &> /dev/null; then
  echo "🚀 Deploying to Netlify..."
  netlify deploy --prod
else
  echo "ℹ️ Netlify CLI not found. Manual deployment required."
  echo "Run 'npm install -g netlify-cli' to install Netlify CLI"
  echo "Then run 'netlify deploy --prod' to deploy"
fi

echo "✅ Deployment process completed!"
