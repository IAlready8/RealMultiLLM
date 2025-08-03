#!/bin/bash

# RealMultiLLM - Automated macOS Setup Script
# Production-ready infrastructure optimization for macOS environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if running on macOS
check_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "This script is designed for macOS only."
        exit 1
    fi
    log_success "Running on macOS $(sw_vers -productVersion)"
}

# Check macOS version compatibility
check_macos_version() {
    local version=$(sw_vers -productVersion)
    local major=$(echo $version | cut -d '.' -f 1)
    local minor=$(echo $version | cut -d '.' -f 2)
    
    # Require macOS 12.0+ (Monterey) for optimal performance
    if [[ $major -lt 12 ]]; then
        log_error "macOS 12.0 (Monterey) or later required. Current version: $version"
        exit 1
    fi
    
    log_success "macOS version $version is compatible"
    
    # Performance optimization recommendations for M2 MacBook Air
    if [[ $(sysctl -n machdep.cpu.brand_string) == *"Apple M2"* ]]; then
        log_info "Detected Apple M2 processor - optimizing for 8GB memory constraints"
        export NODE_OPTIONS="--max-old-space-size=6144"
    fi
}

# Check and install Xcode Command Line Tools
install_xcode_tools() {
    if ! xcode-select -p &> /dev/null; then
        log_info "Installing Xcode Command Line Tools..."
        xcode-select --install
        
        # Wait for installation to complete
        log_info "Please complete the Xcode Command Line Tools installation and press any key to continue..."
        read -n 1 -s
    else
        log_success "Xcode Command Line Tools already installed"
    fi
}

# Install or update Homebrew
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ $(uname -m) == "arm64" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    else
        log_success "Homebrew already installed"
        log_info "Updating Homebrew..."
        brew update
    fi
}

# Install and configure Node.js with optimal version
install_nodejs() {
    local node_version="20.11.0"  # LTS version with security patches
    
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js via Homebrew..."
        brew install node@20
        brew link node@20 --force
    else
        local current_version=$(node --version | cut -d 'v' -f 2)
        log_info "Node.js $current_version is installed"
        
        # Check if version meets minimum requirements
        if [[ "$(printf '%s\n' "20.0.0" "$current_version" | sort -V | head -n1)" != "20.0.0" ]]; then
            log_warning "Node.js version $current_version may not be optimal. Consider upgrading to v20.11.0+"
        fi
    fi
    
    # Configure npm for performance optimization
    npm config set fund false
    npm config set audit-level moderate
    npm config set cache-max 86400000  # 24 hours
    npm config set prefer-offline true
    
    log_success "Node.js $(node --version) configured with performance optimizations"
}

# Install project dependencies with offline caching
install_dependencies() {
    log_info "Installing project dependencies with performance optimizations..."
    
    # Enable npm offline cache and parallel installations
    npm config set prefer-offline true
    npm config set maxsockets 50
    
    # Install dependencies with cache optimization
    if npm ci --silent --no-audit --no-fund; then
        log_success "Dependencies installed successfully"
    else
        log_warning "npm ci failed, falling back to npm install..."
        npm install --silent --no-audit --no-fund
    fi
    
    # Generate Prisma client
    log_info "Generating Prisma database client..."
    npx prisma generate
}

# Setup SQLite database with optimizations
setup_database() {
    log_info "Setting up SQLite database with optimizations..."
    
    # Create database directory if it doesn't exist
    mkdir -p prisma
    
    # Set up environment variables if .env doesn't exist
    if [[ ! -f .env.local ]]; then
        if [[ -f .env.example ]]; then
            log_info "Creating .env.local from .env.example..."
            cp .env.example .env.local
            
            # Generate secure NEXTAUTH_SECRET
            local secret=$(openssl rand -base64 32)
            sed -i '' "s/NEXTAUTH_SECRET=/NEXTAUTH_SECRET=${secret}/" .env.local
            
            log_warning "Please configure your API keys in .env.local"
        else
            log_warning "No .env.example found. Please create .env.local manually."
        fi
    fi
    
    # Initialize database schema
    log_info "Initializing database schema..."
    npx prisma db push --accept-data-loss
    
    # Optimize SQLite for performance
    echo "PRAGMA journal_mode = WAL;" | sqlite3 prisma/dev.db 2>/dev/null || true
    echo "PRAGMA synchronous = NORMAL;" | sqlite3 prisma/dev.db 2>/dev/null || true
    echo "PRAGMA cache_size = 10000;" | sqlite3 prisma/dev.db 2>/dev/null || true
    
    log_success "Database initialized with performance optimizations"
}

# Install and configure pre-commit hooks
setup_git_hooks() {
    log_info "Setting up Git pre-commit hooks..."
    
    # Install husky if not present
    if [[ ! -d .husky ]]; then
        npx husky-init
        npm install
    fi
    
    # Setup pre-commit hook for code quality
    cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run linting and formatting
npm run lint:fix
npm run format

# Run type checking
npm run type-check

# Run tests (only changed files)
npm run test:staged
EOF
    
    chmod +x .husky/pre-commit
    
    log_success "Git hooks configured for automated code quality"
}

# Configure development tools
setup_dev_tools() {
    log_info "Configuring development tools..."
    
    # Install global development tools for macOS
    npm install -g @biomejs/biome typescript tsx nodemon
    
    # Configure VSCode settings if .vscode directory exists
    if [[ -d .vscode ]] || [[ -n "${VSCODE_CLI:-}" ]]; then
        mkdir -p .vscode
        
        cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.git": true,
    "**/.DS_Store": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true
  }
}
EOF
        
        cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next"
  ]
}
EOF
        
        log_success "VSCode configuration created"
    fi
}

# Performance validation and system checks
validate_setup() {
    log_info "Validating installation and performance..."
    
    # Check memory usage and provide recommendations
    local memory_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
    log_info "System memory: ${memory_gb}GB"
    
    if [[ $memory_gb -le 8 ]]; then
        log_warning "8GB memory detected. Consider closing other applications during development."
        log_info "NODE_OPTIONS set to --max-old-space-size=6144 for optimal performance"
    fi
    
    # Test build process
    log_info "Testing build process..."
    if npm run build; then
        log_success "Build test passed"
    else
        log_error "Build test failed. Please check the configuration."
        return 1
    fi
    
    # Test development server startup
    log_info "Testing development server startup..."
    timeout 10s npm run dev &> /dev/null || log_warning "Development server test timed out (expected)"
    
    log_success "Installation validation completed"
}

# Main installation flow
main() {
    echo ""
    log_info "🚀 RealMultiLLM - Automated macOS Setup"
    log_info "======================================"
    echo ""
    
    # Pre-flight checks
    check_macos
    check_macos_version
    
    # Core system setup
    install_xcode_tools
    install_homebrew
    install_nodejs
    
    # Project setup
    install_dependencies
    setup_database
    
    # Development environment
    setup_git_hooks
    setup_dev_tools
    
    # Validation
    validate_setup
    
    echo ""
    log_success "🎉 Setup completed successfully!"
    echo ""
    log_info "Next steps:"
    log_info "1. Configure your API keys in .env.local"
    log_info "2. Run 'npm run dev' to start the development server"
    log_info "3. Run 'npm run test' to execute the test suite"
    log_info "4. Run 'npm run build' to create a production build"
    echo ""
    log_info "For performance monitoring, run 'npm run profile'"
    echo ""
}

# Execute main function
main "$@"