#!/bin/bash

# RealMultiLLM Environment Setup Script for macOS
# Target: 2013 MacBook Pro (16GB RAM) + 2022 MacBook Air M2 (8GB RAM)
# Author: RealMultiLLM Team

set -e  # Exit on any error

echo "🚀 Setting up RealMultiLLM development environment..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get macOS version
get_macos_version() {
    sw_vers -productVersion | cut -d. -f1-2
}

# Check macOS version
MACOS_VERSION=$(get_macos_version)
echo "📍 Detected macOS version: $MACOS_VERSION"

# Check system memory
MEMORY_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
echo "💾 Detected system memory: ${MEMORY_GB}GB"

if [ "$MEMORY_GB" -lt 8 ]; then
    echo "⚠️  Warning: Less than 8GB RAM detected. Performance may be limited."
fi

# 1. Check Node.js installation
echo "🔍 Checking Node.js installation..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js found: $NODE_VERSION"
    
    # Check if Node.js version is >= 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "❌ Node.js version 18+ required. Current: $NODE_VERSION"
        echo "📦 Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
else
    echo "❌ Node.js not found"
    echo "📦 Installing Node.js via Homebrew..."
    if command_exists brew; then
        brew install node@18
    else
        echo "🍺 Please install Homebrew first: https://brew.sh/"
        echo "📦 Then install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
fi

# 2. Check npm and update if needed
echo "🔍 Checking npm..."
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm found: $NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
npm ci

# 4. Set up environment variables
echo "🔧 Setting up environment variables..."
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "📝 Created .env.local from .env.example"
        echo "⚠️  Please edit .env.local with your actual values"
    else
        echo "📝 Creating basic .env.local..."
        cat > .env.local << EOF
# Database (SQLite for development)
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"

# API Keys (add your own)
# OPENAI_API_KEY=""
# ANTHROPIC_API_KEY=""
# GOOGLE_AI_API_KEY=""
EOF
    fi
else
    echo "✅ .env.local already exists"
fi

# 5. Database setup
echo "🗄️  Setting up database..."
if [ -f "prisma/schema.prisma" ]; then
    # Try to generate Prisma client, but don't fail if it doesn't work
    echo "📊 Generating Prisma client..."
    if npm run prisma:generate 2>/dev/null || npx prisma generate 2>/dev/null; then
        echo "✅ Prisma client generated successfully"
        
        # Run migrations for SQLite
        if npx prisma db push 2>/dev/null; then
            echo "✅ Database schema updated"
        else
            echo "⚠️  Database migration failed, but continuing..."
        fi
    else
        echo "⚠️  Prisma generation failed, but continuing..."
    fi
else
    echo "⚠️  No Prisma schema found, skipping database setup"
fi

# 6. Memory optimization check
echo "🧠 Configuring memory optimizations..."
if [ "$MEMORY_GB" -le 8 ]; then
    echo "🔧 Applying 8GB RAM optimizations..."
    # Set Node.js memory limit
    export NODE_OPTIONS="--max-old-space-size=4096"
    echo "export NODE_OPTIONS=\"--max-old-space-size=4096\"" >> ~/.zshrc 2>/dev/null || echo "export NODE_OPTIONS=\"--max-old-space-size=4096\"" >> ~/.bash_profile 2>/dev/null || true
fi

# 7. Validate setup
echo "🔍 Validating setup..."
if npm run type-check 2>/dev/null; then
    echo "✅ TypeScript validation passed"
else
    echo "⚠️  TypeScript validation failed, but setup continues"
fi

# 8. Create basic gitignore entries
echo "📝 Updating .gitignore..."
cat >> .gitignore << 'EOF'

# Local environment
.env.local
.env.production

# Database
prisma/dev.db*
*.db

# Build artifacts
.next/
out/
dist/

# Development
.vscode/settings.json
.idea/

EOF

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Run 'npm run dev' to start development server"
echo "3. Run 'npm test' to verify tests work"
echo "4. Run 'npm run build' to test production build"
echo ""
echo "🔗 Useful commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run test         - Run tests"
echo "  npm run lint         - Run linter"
echo "  npm run type-check   - Check TypeScript"
echo ""
echo "📚 Documentation: See README.md for more details"