#!/bin/bash

# Clean build script for Next.js
echo "🧹 Cleaning Next.js build cache..."

# Remove build directories
if [ -d ".next" ]; then
  rm -rf .next
  echo "✅ Removed .next directory"
fi

if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✅ Removed node_modules cache"
fi

# Kill any running processes
pkill -f "next dev" 2>/dev/null || true
echo "✅ Stopped any running Next.js processes"

# Rebuild
echo "🔨 Running clean build..."
npm run build

echo "🚀 Starting development server..."
npm run dev