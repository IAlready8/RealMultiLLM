#!/bin/bash

# RealMultiLLM - Complete Project Setup Script
# This script sets up the entire development environment for the RealMultiLLM project

set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main setup function
main() {
    log_info "🚀 Starting RealMultiLLM Complete Setup..."
    
    # Step 1: Check system prerequisites
    check_prerequisites
    
    # Step 2: Install Node.js dependencies
    install_node_dependencies
    
    # Step 3: Set up environment variables
    setup_environment
    
    # Step 4: Set up database
    setup_database
    
    # Step 5: Optional Python environment setup
    setup_python_environment
    
    # Step 6: Validate setup
    validate_setup
    
    log_success "🎉 RealMultiLLM setup completed successfully!"
    log_info "To start development:"
    log_info "  npm run dev"
    log_info ""
    log_info "The application will be available at: http://localhost:3000"
}

# Check system prerequisites
check_prerequisites() {
    log_info "📋 Checking system prerequisites..."
    
    # Check Node.js
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js v20 or later from https://nodejs.org/"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current version: $(node --version)"
        log_error "Please update Node.js from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        log_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    log_success "✅ System prerequisites met"
    log_info "  Node.js: $(node --version)"
    log_info "  npm: $(npm --version)"
}

# Install Node.js dependencies
install_node_dependencies() {
    log_info "📦 Installing Node.js dependencies..."
    
    # Try npm ci first, fallback to npm install if it fails
    if [ -f "package-lock.json" ]; then
        if ! npm ci 2>/dev/null; then
            log_warning "⚠️  npm ci failed, running npm install instead..."
            npm install
        fi
    else
        npm install
    fi
    
    log_success "✅ Node.js dependencies installed"
}

# Set up environment variables
setup_environment() {
    log_info "🔧 Setting up environment variables..."
    
    if [ ! -f ".env.example" ]; then
        log_error ".env.example file not found!"
        exit 1
    fi
    
    if [ ! -f ".env.local" ]; then
        log_info "Creating .env.local from .env.example..."
        cp .env.example .env.local
        
        # Generate NEXTAUTH_SECRET if not set
        if command_exists openssl; then
            NEXTAUTH_SECRET=$(openssl rand -base64 32)
            # Replace empty NEXTAUTH_SECRET line using a more compatible approach
            if grep -q "^NEXTAUTH_SECRET=$" .env.local; then
                # Create a temporary file for safer replacement
                awk -v secret="$NEXTAUTH_SECRET" '/^NEXTAUTH_SECRET=$/ {print "NEXTAUTH_SECRET=" secret; next} {print}' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
                log_info "Generated NEXTAUTH_SECRET"
            fi
        fi
        
        log_warning "⚠️  Please edit .env.local and add your API keys:"
        log_warning "   - DATABASE_URL (for database connection)"
        log_warning "   - OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY (for LLM providers)"
        log_warning "   - OAuth credentials if needed (GOOGLE_CLIENT_ID, etc.)"
    else
        log_info ".env.local already exists"
    fi
    
    log_success "✅ Environment variables configured"
}

# Set up database
setup_database() {
    log_info "🗄️  Setting up database..."
    
    # Check if DATABASE_URL is set in .env.local
    if [ -f ".env.local" ] && grep -q "^DATABASE_URL=" .env.local && ! grep -q "^DATABASE_URL=$" .env.local; then
        log_info "DATABASE_URL found, setting up database..."
        
        # Generate Prisma client
        npx prisma generate
        
        # Push database schema
        log_info "Pushing database schema..."
        npx prisma db push
        
        log_success "✅ Database setup completed"
    else
        log_warning "⚠️  DATABASE_URL not configured in .env.local"
        log_warning "   Please set DATABASE_URL in .env.local and run:"
        log_warning "   npx prisma generate && npx prisma db push"
    fi
}

# Set up Python environment (optional)
setup_python_environment() {
    log_info "🐍 Setting up Python environment (optional)..."
    
    if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
        if command_exists python3; then
            # Create virtual environment if it doesn't exist
            if [ ! -d ".venv" ]; then
                log_info "Creating Python virtual environment..."
                python3 -m venv .venv
            fi
            
            # Activate virtual environment and install dependencies
            if [ -f ".venv/bin/activate" ]; then
                log_info "Installing Python dependencies..."
                source .venv/bin/activate
                
                # Try to upgrade pip with timeout handling
                if ! timeout 30 pip install --upgrade pip 2>/dev/null; then
                    log_warning "⚠️  Pip upgrade timed out, continuing with existing version"
                fi
                
                # Install dependencies with timeout handling
                if [ -f "pyproject.toml" ] && command_exists poetry; then
                    if ! timeout 120 poetry install 2>/dev/null; then
                        log_warning "⚠️  Poetry install timed out or failed"
                    fi
                elif [ -f "requirements.txt" ]; then
                    if ! timeout 120 pip install -r requirements.txt 2>/dev/null; then
                        log_warning "⚠️  Requirements.txt install timed out or failed"
                    fi
                fi
                
                deactivate
                log_success "✅ Python environment setup completed"
                log_info "   To activate: source .venv/bin/activate"
            fi
        else
            log_warning "⚠️  Python3 not found. Skipping Python environment setup."
        fi
    else
        log_info "No Python dependencies found, skipping Python setup"
    fi
}

# Validate setup
validate_setup() {
    log_info "🔍 Validating setup..."
    
    # Check if .env.local exists and has required variables
    if [ -f ".env.local" ]; then
        if grep -q "^NEXTAUTH_SECRET=" .env.local && ! grep -q "^NEXTAUTH_SECRET=$" .env.local; then
            log_success "✅ NEXTAUTH_SECRET configured"
        else
            log_warning "⚠️  NEXTAUTH_SECRET not configured"
        fi
    fi
    
    # Check TypeScript compilation
    if command_exists npx; then
        log_info "Testing TypeScript compilation..."
        if npx tsc --noEmit > /dev/null 2>&1; then
            log_success "✅ TypeScript compilation works"
        else
            log_warning "⚠️  TypeScript compilation issues detected"
        fi
    fi
    
    # Test basic Next.js functionality
    log_info "Testing Next.js configuration..."
    if npm run lint > /dev/null 2>&1; then
        log_success "✅ Next.js linting works"
    else
        log_warning "⚠️  Next.js linting issues detected"
    fi
}

# Run main function
main "$@"
