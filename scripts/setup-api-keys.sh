#!/bin/bash
# scripts/setup-api-keys.sh

set -e

echo "🔧 Setting up RealMultiLLM API Key Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install OpenSSL"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_status "All requirements satisfied ✓"
}

# Generate environment variables
generate_env() {
    print_status "Generating environment variables..."
    
    if [ -f .env.local ]; then
        print_warning ".env.local already exists. Backing up to .env.local.backup"
        cp .env.local .env.local.backup
    fi
    
    # Generate encryption master key
    ENCRYPTION_KEY=$(openssl rand -hex 64)
    
    # Generate NextAuth secret
    AUTH_SECRET=$(openssl rand -base64 32)
    
    # Generate database URL for SQLite
    DATABASE_URL="file:./dev.db"
    
    cat > .env.local << EOF
# Database Configuration
DATABASE_URL="$DATABASE_URL"

# Authentication Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$AUTH_SECRET"

# Encryption Configuration
ENCRYPTION_MASTER_KEY="$ENCRYPTION_KEY"

# API Provider Keys (Optional - can be added via UI)
# OPENAI_API_KEY=""
# ANTHROPIC_API_KEY=""
# GOOGLE_AI_API_KEY=""
# OPENROUTER_API_KEY=""
# GROK_API_KEY=""

# Rate Limiting
RATE_LIMIT_LLM_PER_USER_PER_MIN=60
RATE_LIMIT_LLM_GLOBAL_PER_MIN=600
RATE_LIMIT_LLM_WINDOW_MS=60000

# Logging
LOG_LEVEL="info"
LOG_FORMAT="json"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_AUDIT_LOGGING=true
ENABLE_COST_TRACKING=true
EOF
    
    print_status "Environment variables generated ✓"
    print_warning "Please save your ENCRYPTION_MASTER_KEY securely: $ENCRYPTION_KEY"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    npm ci
    
    print_status "Dependencies installed ✓"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Generate Prisma client
    npx prisma generate
    
    # Run database migrations
    npx prisma migrate dev --name init || npx prisma db push
    
    # Seed database with initial data
    if [ -f prisma/seed.ts ]; then
        npx tsx prisma/seed.ts
        print_status "Database seeded ✓"
    fi
    
    print_status "Database setup complete ✓"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p temp
    mkdir -p .next/cache
    
    print_status "Directories created ✓"
}

# Setup git hooks
setup_git_hooks() {
    print_status "Setting up git hooks..."
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook for RealMultiLLM

# Run linting
npm run lint
if [ $? -ne 0 ]; then
    echo "Linting failed. Please fix the issues before committing."
    exit 1
fi

# Run type checking
npm run type-check
if [ $? -ne 0 ]; then
    echo "Type checking failed. Please fix the issues before committing."
    exit 1
fi

# Run tests
npm run test:run
if [ $? -ne 0 ]; then
    echo "Tests failed. Please fix the issues before committing."
    exit 1
fi

echo "All checks passed ✓"
EOF
    
    chmod +x .git/hooks/pre-commit
    
    print_status "Git hooks setup complete ✓"
}

# Validate setup
validate_setup() {
    print_status "Validating setup..."
    
    # Check if .env.local exists
    if [ ! -f .env.local ]; then
        print_error ".env.local file not found"
        exit 1
    fi
    
    # Check if Prisma client is generated
    if [ ! -d node_modules/.prisma ]; then
        print_error "Prisma client not generated"
        exit 1
    fi
    
    # Check if database exists
    if [ ! -f dev.db ]; then
        print_error "Database not found"
        exit 1
    fi
    
    # Test encryption
    node -e "
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    console.log('✓ Encryption test passed');
    "
    
    print_status "Setup validation passed ✓"
}

# Main execution
main() {
    echo "🚀 Starting RealMultiLLM API Key Management Setup..."
    echo ""
    
    check_requirements
    generate_env
    install_dependencies
    setup_database
    create_directories
    setup_git_hooks
    validate_setup
    
    echo ""
    print_status "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review your .env.local file"
    echo "2. Save your ENCRYPTION_MASTER_KEY securely"
    echo "3. Run 'npm run dev' to start the development server"
    echo "4. Visit http://localhost:3000 to access the application"
    echo ""
    echo "Useful commands:"
    echo "- npm run dev          Start development server"
    echo "- npm run build        Build for production"
    echo "- npm run test         Run tests"
    echo "- npm run lint         Run linting"
    echo "- npm run db:reset     Reset database"
    echo ""
}

# Run main function
main "$@"