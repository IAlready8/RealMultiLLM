#!/bin/bash
# 🚀 RealMultiLLM Build Script
# 3-STEP PLAN:
# 1. Validate the codebase
# 2. Build the Next.js application
# 3. Verify the build

set -e  # Exit immediately on error
echo "🚀 Starting build process for RealMultiLLM..."

# STEP 1: Validate codebase before building
echo "🔍 Validating codebase..."
npm run validate

# STEP 2: Build the application
echo "🔨 Building application..."
npm run build

# STEP 3: Verify build output
echo "✅ Verifying build output..."
if [ ! -d ".next" ]; then
  echo "❌ Build failed. '.next' directory not found."
  exit 1
fi

echo "🎉 Build complete! Ready for production."
