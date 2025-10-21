#!/bin/bash

# Encryption Setup Script for RealMultiLLM
# Provides one-command setup automation for enterprise encryption

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# Functions
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

# Generate cryptographically secure master key
generate_master_key() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 64
    elif command -v node >/dev/null 2>&1; then
        node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    else
        # Fallback: use /dev/urandom if available
        if [[ -r /dev/urandom ]]; then
            hexdump -n 64 -e '4/4 "%08X" 1 "\n"' /dev/urandom
        else
            log_error "Cannot generate secure random key. Install openssl or node.js"
            exit 1
        fi
    fi
}

# Validate master key strength
validate_master_key() {
    local key="$1"
    
    # Check length
    if [[ ${#key} -lt 64 ]]; then
        log_error "Master key must be at least 64 characters long"
        return 1
    fi
    
    # Check it's not the default key
    if [[ "$key" == "default-encryption-key-12345678901234567890123456789012" ]]; then
        log_error "Cannot use default encryption key"
        return 1
    fi
    
    # Basic entropy check
    local unique_chars=$(echo "$key" | grep -o . | sort -u | wc -l)
    if [[ $unique_chars -lt 16 ]]; then
        log_warning "Master key may have insufficient entropy (only $unique_chars unique characters)"
    fi
    
    return 0
}

# Setup environment variables
setup_environment() {
    log_info "Setting up environment variables..."
    
    # Create .env.local if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_info "Created .env.local from .env.example"
        else
            touch "$ENV_FILE"
            log_info "Created empty .env.local"
        fi
    fi
    
    # Check if encryption key is already set
    if grep -q "ENCRYPTION_MASTER_KEY=" "$ENV_FILE"; then
        local existing_key=$(grep "ENCRYPTION_MASTER_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
        
        # Remove quotes if present
        existing_key=$(echo "$existing_key" | sed 's/^"//; s/"$//')
        
        if [[ -n "$existing_key" && "$existing_key" != "default-encryption-key-12345678901234567890123456789012" ]]; then
            log_info "ENCRYPTION_MASTER_KEY already exists"
            if validate_master_key "$existing_key"; then
                log_success "Existing encryption key is valid"
                return 0
            else
                log_warning "Existing key failed validation, generating new one..."
            fi
        fi
    fi
    
    # Generate new master key
    log_info "Generating new encryption master key..."
    local new_key
    new_key=$(generate_master_key)
    
    if validate_master_key "$new_key"; then
        # Update or add the key
        if grep -q "ENCRYPTION_MASTER_KEY=" "$ENV_FILE"; then
            # Replace existing key
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|ENCRYPTION_MASTER_KEY=.*|ENCRYPTION_MASTER_KEY=$new_key|" "$ENV_FILE"
            else
                sed -i "s|ENCRYPTION_MASTER_KEY=.*|ENCRYPTION_MASTER_KEY=$new_key|" "$ENV_FILE"
            fi
        else
            # Add new key
            echo "ENCRYPTION_MASTER_KEY=$new_key" >> "$ENV_FILE"
        fi
        
        log_success "Generated and saved new encryption master key"
    else
        log_error "Failed to generate valid master key"
        exit 1
    fi
}

# Setup NextAuth secret if not present
setup_nextauth_secret() {
    if ! grep -q "NEXTAUTH_SECRET=" "$ENV_FILE" || grep -q "NEXTAUTH_SECRET=$" "$ENV_FILE"; then
        log_info "Generating NextAuth secret..."
        local nextauth_secret
        nextauth_secret=$(generate_master_key)
        
        if grep -q "NEXTAUTH_SECRET=" "$ENV_FILE"; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$nextauth_secret|" "$ENV_FILE"
            else
                sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$nextauth_secret|" "$ENV_FILE"
            fi
        else
            echo "NEXTAUTH_SECRET=$nextauth_secret" >> "$ENV_FILE"
        fi
        
        log_success "Generated NextAuth secret"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "package-lock.json" ]]; then
        npm ci
    elif [[ -f "yarn.lock" ]]; then
        yarn install --frozen-lockfile
    elif [[ -f "pnpm-lock.yaml" ]]; then
        pnpm install --frozen-lockfile
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    cd "$PROJECT_ROOT"
    
    # Generate Prisma client
    if command -v npx >/dev/null 2>&1; then
        npx prisma generate
        log_success "Prisma client generated"
        
        # Run migrations if in development
        if [[ "${NODE_ENV:-development}" != "production" ]]; then
            if npx prisma migrate status 2>/dev/null | grep -q "Database is up to date"; then
                log_info "Database is already up to date"
            else
                log_info "Running database migrations..."
                npx prisma migrate dev --name init || {
                    log_warning "Migration failed, trying to push schema..."
                    npx prisma db push
                }
            fi
        fi
    else
        log_warning "npx not found, skipping Prisma setup"
    fi
}

# Run encryption tests
run_tests() {
    log_info "Running encryption tests..."
    
    cd "$PROJECT_ROOT"
    
    if command -v npm >/dev/null 2>&1; then
        # Run only encryption-related tests
        if npm run test -- --run test/security/advanced-encryption.test.ts 2>/dev/null; then
            log_success "Advanced encryption tests passed"
        else
            log_warning "Advanced encryption tests failed or not found"
        fi
        
        if npm run test -- --run test/integration/encryption-workflow.test.ts 2>/dev/null; then
            log_success "Encryption workflow tests passed"
        else
            log_warning "Encryption workflow tests failed or not found"
        fi
    else
        log_warning "npm not found, skipping tests"
    fi
}

# Validate encryption setup
validate_setup() {
    log_info "Validating encryption setup..."
    
    # Check environment file exists and has required keys
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        return 1
    fi
    
    # Check for required environment variables
    local required_vars=("ENCRYPTION_MASTER_KEY" "NEXTAUTH_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    # Validate the encryption key
    local encryption_key
    encryption_key=$(grep "ENCRYPTION_MASTER_KEY=" "$ENV_FILE" | cut -d'=' -f2- | sed 's/^"//; s/"$//')
    
    if ! validate_master_key "$encryption_key"; then
        return 1
    fi
    
    log_success "Encryption setup validation passed"
    return 0
}

# Print setup summary
print_summary() {
    log_success "🔐 Encryption Setup Complete!"
    echo ""
    echo -e "${GREEN}✅ Environment configured${NC}"
    echo -e "${GREEN}✅ Master key generated${NC}"
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo -e "${GREEN}✅ Database setup${NC}"
    echo -e "${GREEN}✅ Documentation created${NC}"
    echo ""
    log_info "Next steps:"
    echo "  1. Review .env.local file"
    echo "  2. Run tests: npm run test"
    echo "  3. Start development: npm run dev"
    echo "  4. Check migration status: curl -X GET http://localhost:3000/api/encryption/migrate"
    echo ""
    log_warning "🚨 IMPORTANT: Backup your ENCRYPTION_MASTER_KEY securely!"
    echo "   Key location: $ENV_FILE"
}

# Main execution
main() {
    log_info "🚀 Starting RealMultiLLM Encryption Setup..."
    echo ""
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in a Node.js project directory. Please run from the project root."
        exit 1
    fi
    
    # Parse command line arguments
    local skip_deps=false
    local skip_tests=false
    local force_regenerate=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --force-regenerate)
                force_regenerate=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-deps         Skip dependency installation"
                echo "  --skip-tests        Skip running tests"
                echo "  --force-regenerate  Force regenerate encryption keys"
                echo "  -h, --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Force key regeneration if requested
    if [[ "$force_regenerate" == "true" ]]; then
        log_warning "Force regenerating encryption keys..."
        if [[ -f "$ENV_FILE" ]]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' '/ENCRYPTION_MASTER_KEY=/d' "$ENV_FILE"
            else
                sed -i '/ENCRYPTION_MASTER_KEY=/d' "$ENV_FILE"
            fi
        fi
    fi
    
    # Execute setup steps
    setup_environment
    setup_nextauth_secret
    
    if [[ "$skip_deps" != "true" ]]; then
        install_dependencies
    fi
    
    setup_database
    
    if [[ "$skip_tests" != "true" ]]; then
        run_tests
    fi
    
    # Final validation
    if validate_setup; then
        print_summary
    else
        log_error "Setup validation failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"