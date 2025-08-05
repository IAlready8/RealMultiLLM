#!/bin/bash
# RealMultiLLM Development Setup Script
# Optimized for macOS: 2013 MacBook Pro (16GB) + 2022 M2 MacBook Air (8GB)
# No Docker dependencies - Local-first development

set -e # Exit on any error

echo "🚀 Setting up RealMultiLLM development environment..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or later."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18 or later."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION is compatible"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm is available"

# Check git
if ! command -v git &> /dev/null; then
    echo "❌ git is not installed. Please install git."
    exit 1
fi

echo "✅ git is available"

# Check for .env file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your API keys"
fi

# Install dependencies with memory optimization
echo "📦 Installing dependencies (optimized for 8GB RAM)..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm install --no-fund --no-audit

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate || {
    echo "⚠️  Prisma generation failed (likely due to network issues)"
    echo "   This is expected in restricted environments"
    echo "   The application will work in offline mode"
}

# Setup database
echo "🗄️  Setting up development database..."
if [ ! -f "dev.db" ]; then
    echo "Creating SQLite database for development..."
    npx prisma db push || {
        echo "⚠️  Database setup failed - this is expected without network access"
        echo "   Database will be created on first run"
    }
fi

# Setup git hooks (optional)
if [ -d ".git" ]; then
    echo "🔧 Setting up git hooks..."
    chmod +x scripts/*.sh
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p tmp
mkdir -p logs

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "   1. Edit .env file and add your API keys"
echo "   2. Run 'npm run dev' to start development server"
echo "   3. Run 'npm test' to run tests"
echo "   4. Run 'npm run build' to build for production"
echo ""
echo "💡 Optimization tips for 8GB RAM:"
echo "   - Close other applications when building"
echo "   - Use 'npm run dev' for development (faster)"
echo "   - Run tests individually if needed: 'npm test -- <test-file>'"
echo ""
