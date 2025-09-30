#!/bin/bash
# Pre-deployment validation script for Vercel
# Ensures all requirements are met before deploying

set -e

echo "🚀 RealMultiLLM - Vercel Deployment Validation"
echo "==============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to print status
print_status() {
    if [ $2 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ((ERRORS++))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check Node.js
echo -e "${BLUE}🔍 Checking Prerequisites${NC}"
echo "─────────────────────────"
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION" 0
    # Check if version is 18+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js version should be 18 or higher (found: $NODE_VERSION)"
    fi
else
    print_status "Node.js installed" 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_status "npm installed: $NPM_VERSION" 0
else
    print_status "npm installed" 1
fi

# Check if we're in a git repository
if [ -d .git ]; then
    print_status "Git repository found" 0
else
    print_status "Git repository found" 1
fi

echo ""

# Check package.json
echo -e "${BLUE}📦 Checking Project Configuration${NC}"
echo "──────────────────────────────────"
if [ -f package.json ]; then
    print_status "package.json exists" 0
    
    # Check for required scripts
    if grep -q '"build"' package.json; then
        print_status "Build script configured" 0
    else
        print_status "Build script configured" 1
    fi
    
    if grep -q '"prebuild".*"prisma generate"' package.json; then
        print_status "Prisma prebuild configured" 0
    else
        print_warning "Prisma generate should run in prebuild"
    fi
    
    if grep -q '"start"' package.json; then
        print_status "Start script configured" 0
    else
        print_status "Start script configured" 1
    fi
else
    print_status "package.json exists" 1
fi

# Check Next.js config
if [ -f next.config.mjs ] || [ -f next.config.js ]; then
    print_status "Next.js config exists" 0
else
    print_status "Next.js config exists" 1
fi

# Check Prisma schema
if [ -f prisma/schema.prisma ]; then
    print_status "Prisma schema exists" 0
    
    # Check if using PostgreSQL
    if grep -q 'provider.*=.*"postgresql"' prisma/schema.prisma; then
        print_status "PostgreSQL configured in schema" 0
    else
        print_warning "Schema should use PostgreSQL for production"
    fi
else
    print_status "Prisma schema exists" 1
fi

echo ""

# Check required files
echo -e "${BLUE}📁 Checking Required Files${NC}"
echo "─────────────────────────"
[ -f vercel.json ] && print_status "vercel.json exists" 0 || print_warning "vercel.json not found (optional but recommended)"
[ -f .env.example ] && print_status ".env.example exists" 0 || print_warning ".env.example not found"
[ -f .env.production.example ] && print_status ".env.production.example exists" 0 || print_warning ".env.production.example not found"
[ -f README.md ] && print_status "README.md exists" 0 || print_warning "README.md not found"
[ -f VERCEL_DEPLOYMENT.md ] && print_status "VERCEL_DEPLOYMENT.md exists" 0 || print_warning "Deployment docs not found"

echo ""

# Check .gitignore
echo -e "${BLUE}🔒 Checking Security${NC}"
echo "────────────────────"
if [ -f .gitignore ]; then
    print_status ".gitignore exists" 0
    
    # Check for important entries
    if grep -q '.env.local' .gitignore; then
        print_status ".env.local in .gitignore" 0
    else
        print_status ".env.local in .gitignore" 1
    fi
    
    if grep -q '.env.production' .gitignore; then
        print_status ".env.production in .gitignore" 0
    else
        print_warning ".env.production should be in .gitignore"
    fi
    
    if grep -q 'node_modules' .gitignore; then
        print_status "node_modules in .gitignore" 0
    else
        print_status "node_modules in .gitignore" 1
    fi
else
    print_status ".gitignore exists" 1
fi

# Check for committed secrets
if [ -f .env ] || [ -f .env.local ] || [ -f .env.production ]; then
    print_status "No .env files committed" 1
    echo -e "${RED}  Found .env files in repository. These should NOT be committed!${NC}"
else
    print_status "No .env files committed" 0
fi

echo ""

# Check dependencies
echo -e "${BLUE}📚 Checking Dependencies${NC}"
echo "────────────────────────"
if [ -d node_modules ]; then
    print_status "node_modules exists" 0
    
    # Check for key dependencies
    [ -d node_modules/next ] && print_status "next installed" 0 || print_status "next installed" 1
    [ -d node_modules/@prisma/client ] && print_status "@prisma/client installed" 0 || print_status "@prisma/client installed" 1
    [ -d node_modules/next-auth ] && print_status "next-auth installed" 0 || print_status "next-auth installed" 1
else
    print_status "Dependencies installed" 1
    echo -e "${YELLOW}  Run 'npm install' to install dependencies${NC}"
fi

echo ""

# Try to build the project
echo -e "${BLUE}🏗️  Testing Build${NC}"
echo "────────────────"
print_info "Attempting to build project (this may take a few minutes)..."

# Set required env vars for build
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="test-secret-for-build-validation-at-least-32-chars"
export DATABASE_URL="file:./dev.db"
export ENCRYPTION_MASTER_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
export ALLOW_DEMO_MODE="true"

if npm run build > /tmp/build.log 2>&1; then
    print_status "Build successful" 0
    print_info "Build output saved to /tmp/build.log"
else
    print_status "Build successful" 1
    echo -e "${RED}  Build failed. Check /tmp/build.log for details${NC}"
    echo -e "${YELLOW}  Last 20 lines of build log:${NC}"
    tail -20 /tmp/build.log
fi

echo ""

# Check Vercel CLI
echo -e "${BLUE}🚀 Checking Vercel CLI${NC}"
echo "─────────────────────"
if command_exists vercel; then
    VERCEL_VERSION=$(vercel --version)
    print_status "Vercel CLI installed: $VERCEL_VERSION" 0
else
    print_warning "Vercel CLI not installed (optional)"
    print_info "Install with: npm install -g vercel"
fi

echo ""

# Summary
echo -e "${BLUE}📊 Validation Summary${NC}"
echo "═══════════════════════"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your project is ready for Vercel deployment."
    echo ""
    echo "Next steps:"
    echo "  1. Set up your database (Supabase or Neon)"
    echo "  2. Configure environment variables in Vercel Dashboard"
    echo "  3. Push to GitHub"
    echo "  4. Deploy to Vercel"
    echo ""
    echo "See VERCEL_DEPLOYMENT.md for detailed instructions."
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s)${NC}"
    [ $WARNINGS -gt 0 ] && echo -e "${YELLOW}⚠️  Found $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    echo "Common fixes:"
    echo "  - Run 'npm install' to install dependencies"
    echo "  - Ensure you're in the project root directory"
    echo "  - Check that all required files exist"
    echo "  - Fix any build errors"
    echo ""
    exit 1
fi
