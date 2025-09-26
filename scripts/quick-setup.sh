#!/bin/bash
# Quick Development Setup for RealMultiLLM
# Run this script to get started quickly in any environment

set -e

echo "🚀 RealMultiLLM Quick Setup"
echo "=========================="

# Ensure we are in project root
if [ ! -f "package.json" ]; then
  echo "❌ Please run this script from the RealMultiLLM root directory"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Setting up environment..."
if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  cp .env.example .env
  echo "📝 Created .env from template"
  echo "⚠️  Update .env with your provider credentials"
fi

echo "🗄️  Preparing development database..."
if [ ! -f "dev.db" ] && [ ! -f "prisma/dev.db" ]; then
  touch prisma/dev.db
  echo "📁 Created SQLite database file at prisma/dev.db"
fi

echo "🧪 Running quick validation (type-check)..."
if npm run type-check; then
  echo "✅ TypeScript compilation successful"
else
  echo "⚠️  TypeScript reported issues (expected if env vars missing)"
fi

echo ""
echo "🎯 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add provider API keys"
echo "2. Start dev server with: npm run dev"
echo "3. Run tests with: npm run test"
echo "4. Build for production with: npm run build"
echo ""
echo "💡 Netlify deployment tips"
echo "   - Configure environment variables in Netlify"
echo "   - Use PostgreSQL DATABASE_URL in production"
echo "   - Build command: npm run build"
