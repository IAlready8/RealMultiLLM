#!/bin/bash
# RealMultiLLM Deployment Script
# Optimized for macOS systems with limited resources (8GB RAM)

# 3-STEP PLAN:
# 1. Validate environment and dependencies with resource monitoring
# 2. Run tests and build process with memory-optimized settings
# 3. Deploy to Netlify with proper configuration and error handling

set -e # Exit on any error

echo "🚀 Starting RealMultiLLM deployment process..."

# Function to check available memory (macOS)
check_memory() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    local available_mb=$(vm_stat | awk '/free/ {print $3}' | sed 's/\.//' | awk '{print $1 * 4096 / 1024 / 1024}')
    echo "Available memory: ${available_mb}MB"
    if (( $(echo "$available_mb < 1000" | bc -l) )); then
      echo "⚠️ Low memory detected. Using optimized build settings."
      export MEMORY_CONSTRAINED=true
    fi
  fi
}

# Check system resources
check_memory

# Check Node version
node_version=$(node -v | sed 's/v//')
major_version=$(echo $node_version | cut -d. -f1)

if [ "$major_version" -lt 16 ] || [ "$major_version" -gt 20 ]; then
  echo "❌ Node.js version 16-20 is required. Current: v$node_version"
  exit 1
fi

echo "✅ Node.js version: v$node_version"

# Check for required environment variables
required_envs=("NEXTAUTH_SECRET")
optional_envs=("DATABASE_URL" "OPENAI_API_KEY" "ANTHROPIC_API_KEY")
missing_required=()
missing_optional=()

for env in "${required_envs[@]}"; do
  if [ -z "${!env}" ]; then
    missing_required+=("$env")
  fi
done

for env in "${optional_envs[@]}"; do
  if [ -z "${!env}" ]; then
    missing_optional+=("$env")
  fi
done

if [ ${#missing_required[@]} -ne 0 ]; then
  echo "❌ Missing required environment variables: ${missing_required[*]}"
  echo "Please set them in .env or your environment"
  exit 1
fi

if [ ${#missing_optional[@]} -ne 0 ]; then
  echo "⚠️ Missing optional environment variables: ${missing_optional[*]}"
  echo "Some features may not work properly"
fi

# Set memory-optimized build options
if [ "$MEMORY_CONSTRAINED" = true ]; then
  export NODE_OPTIONS="--max-old-space-size=3072 --max-semi-space-size=128"
  echo "🔧 Using memory-constrained build settings"
else
  export NODE_OPTIONS="--max-old-space-size=4096"
fi

# Clean previous build files
echo "🧹 Cleaning previous build artifacts..."
rm -rf .next out node_modules/.cache

# Install dependencies with memory optimization
echo "📦 Installing dependencies..."
npm ci --no-fund --no-audit --prefer-offline

# Set up database with fallback
echo "🗄️ Setting up database..."
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:./dev.db"
  echo "Using default SQLite database for development"
fi

# Generate Prisma client with retries
echo "🔄 Generating Prisma client..."
for i in {1..3}; do
  if npx prisma generate; then
    break
  else
    echo "Attempt $i failed, retrying..."
    sleep 2
  fi
done

# Push database schema (for development)
if [[ "$DATABASE_URL" == file:* ]]; then
  echo "📋 Setting up local database schema..."
  npx prisma db push --skip-generate
fi

# Run type checking
echo "🔍 Running type checking..."
npm run type-check

# Run tests with memory optimization
echo "🧪 Running tests..."
if [ "$MEMORY_CONSTRAINED" = true ]; then
  # Skip heavy integration tests on constrained systems
  npm run test:ci -- --maxWorkers=1
else
  npm run test:ci
fi

# Build the application
echo "🏗️ Building the application..."
npm run build

# Verify build
if [ ! -d ".next" ]; then
  echo "❌ Build failed - .next directory not found"
  exit 1
fi

echo "✅ Build completed successfully"

# Deploy using Netlify CLI if available
if command -v netlify &> /dev/null; then
  echo "🚀 Deploying to Netlify..."
  
  # Check if we're in a Git repository
  if git rev-parse --git-dir > /dev/null 2>&1; then
    netlify deploy --prod --timeout 300
  else
    echo "⚠️ Not in a Git repository. Using manual deployment."
    netlify deploy --prod --dir=.next --timeout 300
  fi
  
  echo "✅ Deployment completed!"
else
  echo "ℹ️ Netlify CLI not found."
  echo "To deploy manually:"
  echo "1. Install Netlify CLI: npm install -g netlify-cli"
  echo "2. Run: netlify deploy --prod"
  echo "3. Or zip the .next folder and upload to Netlify dashboard"
fi

echo "🎉 RealMultiLLM deployment process completed successfully!"
