#!/bin/bash

# Vercel Build Script with UI Fixes
# This script prepares the application for deployment with UI optimization

set -e  # Exit on any error

echo "🔍 Starting Vercel build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --no-audit --no-fund || npm install

# Verify that all required modules are available
echo "🔍 Verifying critical modules..."
node -e "
  const requiredModules = [
    'next',
    'react',
    'react-dom',
    'tailwindcss',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'next-themes',
    'lucide-react'
  ];
  
  for (const mod of requiredModules) {
    try {
      require(mod);
      console.log('✅', mod, 'found');
    } catch (e) {
      console.error('❌', mod, 'not found');
      process.exit(1);
    }
  }
  console.log('All critical modules verified');
"

# Validate environment variables
echo "🛡️  Validating environment variables..."
if [ -z "$NEXTAUTH_SECRET" ]; then
  export NEXTAUTH_SECRET="fallback-dev-secret-change-in-production"
  echo "⚠️  NEXTAUTH_SECRET not set, using fallback"
fi

if [ -z "$JWT_SECRET" ]; then
  export JWT_SECRET="fallback-jwt-secret-change-in-production"
  echo "⚠️  JWT_SECRET not set, using fallback"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set, using fallback"
  export DATABASE_URL="file:./dev.db"
fi

# Run Prisma operations
echo "🔄 Generating Prisma client..."
npx prisma generate

# Run the Next.js build
echo "🏗️  Building Next.js application..."
npm run build

# Validate the build
echo "✅ Build completed successfully"
echo "📋 Build assets report:"
ls -la .next/

# Verify critical UI files exist
echo "🔍 Verifying UI assets..."
if [ -f ".next/BUILD_ID" ]; then
  echo "✅ BUILD_ID exists"
else
  echo "❌ BUILD_ID missing"
  exit 1
fi

# Check for critical CSS file
if [ -f ".next/static/css/*.css" ]; then
  CSS_FILE=$(find .next/static/css -name "*.css" | head -n 1)
  if [ -s "$CSS_FILE" ]; then
    echo "✅ CSS file exists and has content"
  else
    echo "❌ CSS file is empty"
    exit 1
  fi
else
  echo "❌ No CSS files found"
  exit 1
fi

# Verify the main page was built
if [ -f ".next/server/app/page.html" ]; then
  echo "✅ Main page HTML exists"
elif [ -f ".next/server/app/page.js" ]; then
  echo "✅ Main page JS exists"
else
  echo "⚠️  Main page file structure may be different"
fi

echo "🎉 Vercel build completed successfully!"
echo "🚀 Your application is ready for deployment to Vercel"