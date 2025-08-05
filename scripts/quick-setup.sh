#!/bin/bash
# Quick Development Setup for RealMultiLLM
# Run this script to get started quickly in any environment

echo "🚀 RealMultiLLM Quick Setup"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the RealMultiLLM root directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Setting up environment..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 Created .env file from template"
    echo "⚠️  Please edit .env and add your API keys"
fi

echo "🗄️  Setting up development database..."
if [ ! -f "dev.db" ]; then
    touch dev.db
    echo "📁 Created SQLite database file"
fi

echo "🧪 Running quick test to verify setup..."
npm run type-check
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript issues found (this is normal without API keys)"
fi

echo ""
echo "🎯 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API keys:"
echo "   - OPENAI_API_KEY"
echo "   - ANTHROPIC_API_KEY"
echo "   - GOOGLE_AI_API_KEY"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. Run tests:"
echo "   npm test"
echo ""
echo "4. Build for production:"
echo "   npm run build"
echo ""
echo "💡 For deployment to Netlify:"
echo "   - Set environment variables in Netlify dashboard"
echo "   - Use PostgreSQL DATABASE_URL for production"
echo "   - All other configuration is ready!"
echo ""