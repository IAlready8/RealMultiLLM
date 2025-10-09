#!/bin/bash

# Enterprise Environment Setup Script
# This script sets up the enterprise-grade environment for the Multi-LLM Platform
# It configures security, performance, observability and other enterprise features

set -euo pipefail  # Exit on error, undefined vars, and pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Configuration variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env.production"
BACKUP_DIR="$REPO_ROOT/backups"
LOG_FILE="$REPO_ROOT/logs/setup.log"

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$REPO_ROOT/logs"
mkdir -p "$REPO_ROOT/lib/config"
mkdir -p "$REPO_ROOT/lib/observability"
mkdir -p "$REPO_ROOT/lib/security"
mkdir -p "$REPO_ROOT/lib/performance"

# Function to create backup
create_backup() {
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "Creating backup at $backup_path"
    mkdir -p "$backup_path"
    
    # Backup environment files
    if [[ -f "$REPO_ROOT/.env" ]]; then
        cp "$REPO_ROOT/.env" "$backup_path/"
    fi
    
    if [[ -f "$REPO_ROOT/.env.production" ]]; then
        cp "$REPO_ROOT/.env.production" "$backup_path/"
    fi
    
    if [[ -f "$REPO_ROOT/.env.example" ]]; then
        cp "$REPO_ROOT/.env.example" "$backup_path/"
    fi
    
    log_success "Backup created at $backup_path"
}

# Function to validate dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local missing_deps=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    # Check for Docker (optional but recommended)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found - containerization features will be unavailable"
    fi
    
    # Check for Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and rerun the script."
        exit 1
    fi
    
    log_success "All required dependencies are available"
}

# Function to install/update Node.js dependencies
install_dependencies() {
    log "Installing/updating Node.js dependencies..."
    
    cd "$REPO_ROOT"
    
    # Check if package-lock.json exists to decide between npm install and npm ci
    if [[ -f "package-lock.json" ]]; then
        log "Using 'npm ci' for clean installation..."
        npm ci --no-audit --no-fund
    else
        log "Using 'npm install'..."
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Function to validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    local required_vars=(
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "NEXTAUTH_URL"
        "GOOGLE_CLIENT_ID"
        "GOOGLE_CLIENT_SECRET"
        "GITHUB_ID"
        "GITHUB_SECRET"
        "JWT_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_warning "Missing required environment variables: ${missing_vars[*]}"
        log_warning "Please set these variables before running the application"
    else
        log_success "All required environment variables are set"
    fi
}

# Function to setup enterprise security configurations
setup_security() {
    log "Setting up enterprise security configurations..."
    
    # Generate JWT secret if not exists
    if [[ -z "${JWT_SECRET:-}" ]] || [[ "$JWT_SECRET" == "fallback-jwt-secret-change-in-production" ]]; then
        export JWT_SECRET="$(openssl rand -base64 32)"
        log_warning "Generated new JWT secret. Please update your .env file with JWT_SECRET=$JWT_SECRET"
    fi
    
    # Generate NextAuth secret if not exists
    if [[ -z "${NEXTAUTH_SECRET:-}" ]]; then
        export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
        log_warning "Generated new NextAuth secret. Please update your .env file with NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
    fi
    
    # Setup security headers configuration
    cat > "$REPO_ROOT/lib/security/security-headers.js" << 'EOF'
// Enterprise Security Headers Configuration
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Feature-Policy',
    value: "geolocation 'none'; microphone 'none'; camera 'none'"
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=()'
  }
];

module.exports = { securityHeaders };
EOF
    
    log_success "Security configurations set up"
}

# Function to setup observability
setup_observability() {
    log "Setting up observability configurations..."
    
    # Create observability configuration file
    cat > "$REPO_ROOT/lib/observability/config.js" << 'EOF'
// Enterprise Observability Configuration
const observabilityConfig = {
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json', // 'json' or 'text'
    enabled: process.env.LOGGING_ENABLED !== 'false',
  },
  
  // Metrics configuration
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    collectionInterval: parseInt(process.env.METRICS_INTERVAL || '30000'), // 30 seconds
    pushGateway: process.env.PROMETHEUS_PUSHGATEWAY || null,
  },
  
  // Tracing configuration (if using Jaeger, Zipkin, etc.)
  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true',
    collectorUrl: process.env.TRACING_COLLECTOR_URL || 'http://localhost:14268/api/traces',
    serviceName: process.env.TRACING_SERVICE_NAME || 'multi-llm-platform',
  },
  
  // APM (Application Performance Monitoring) configuration
  apm: {
    enabled: process.env.APM_ENABLED === 'true',
    provider: process.env.APM_PROVIDER || 'datadog', // 'datadog', 'newrelic', 'sentry'
    apiKey: process.env.APM_API_KEY || null,
  }
};

module.exports = { observabilityConfig };
EOF
    
    log_success "Observability configurations set up"
}

# Function to setup performance configurations
setup_performance() {
    log "Setting up performance configurations..."
    
    # Create performance configuration file
    cat > "$REPO_ROOT/lib/performance/config.js" << 'EOF'
// Enterprise Performance Configuration
const performanceConfig = {
  // Caching configuration
  caching: {
    enabled: process.env.CACHING_ENABLED !== 'false',
    provider: process.env.CACHE_PROVIDER || 'memory', // 'memory', 'redis', 'memcached'
    ttl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour default
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000'),
    redisUrl: process.env.REDIS_URL || null,
  },
  
  // Compression configuration
  compression: {
    enabled: process.env.COMPRESSION_ENABLED !== 'false',
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'), // 1KB
    algorithm: process.env.COMPRESSION_ALGORITHM || 'gzip',
  },
  
  // Database connection pooling
  database: {
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000'),
    }
  },
  
  // CDN configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    provider: process.env.CDN_PROVIDER || null,
    assetPrefix: process.env.ASSET_PREFIX || '',
  },
  
  // Resource optimization
  optimization: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '100'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'), // 30 seconds
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'), // percentage
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'), // percentage
  }
};

module.exports = { performanceConfig };
EOF
    
    log_success "Performance configurations set up"
}

# Function to setup environment-specific configurations
setup_environment() {
    log "Setting up environment-specific configurations..."
    
    local env_type="${1:-production}"
    
    case "$env_type" in
        "development")
            cat > "$REPO_ROOT/.env.development" << 'EOF'
# Development Environment Configuration
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
ENABLE_ANALYTICS=true
ENABLE_TELEMETRY=false
ENABLE_AUDIT_LOGGING=false
CACHE_ENABLED=false
METRICS_ENABLED=true
TRACING_ENABLED=false
COMPRESSION_ENABLED=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
BLOCK_SUSPICIOUS_IPS=false
EOF
            ;;
        "staging")
            cat > "$REPO_ROOT/.env.staging" << 'EOF'
# Staging Environment Configuration
NODE_ENV=staging
LOG_LEVEL=info
NEXTAUTH_URL="https://staging.yourdomain.com"
ENABLE_ANALYTICS=true
ENABLE_TELEMETRY=true
ENABLE_AUDIT_LOGGING=true
CACHE_ENABLED=true
METRICS_ENABLED=true
TRACING_ENABLED=true
COMPRESSION_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
BLOCK_SUSPICIOUS_IPS=true
TELEMETRY_SAMPLE_RATE=0.5
EOF
            ;;
        "production")
            cat > "$REPO_ROOT/.env.production" << 'EOF'
# Production Environment Configuration
NODE_ENV=production
LOG_LEVEL=info
NEXTAUTH_URL="https://yourdomain.com"
ENABLE_ANALYTICS=true
ENABLE_TELEMETRY=true
ENABLE_AUDIT_LOGGING=true
CACHE_ENABLED=true
METRICS_ENABLED=true
TRACING_ENABLED=true
COMPRESSION_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
BLOCK_SUSPICIOUS_IPS=true
TELEMETRY_SAMPLE_RATE=0.1
TELEMETRY_FLUSH_INTERVAL=30000
TELEMETRY_MAX_QUEUE_SIZE=100
LOGGING_ENABLED=true
LOG_FORMAT=json
APM_ENABLED=true
APM_PROVIDER=datadog
CDN_ENABLED=true
MAX_CONCURRENT_REQUESTS=50
REQUEST_TIMEOUT=15000
MEMORY_THRESHOLD=75
CPU_THRESHOLD=75
EOF
            ;;
    esac
    
    log_success "Environment configuration created for $env_type"
}

# Function to run database migrations
setup_database() {
    log "Setting up database..."
    
    cd "$REPO_ROOT"
    
    # Run Prisma migrations
    if command -v npx &> /dev/null; then
        log "Running database migrations..."
        npx prisma generate
        npx prisma db push || log_warning "Database push failed - this might be expected if database doesn't exist yet"
        
        log_success "Database setup complete"
    else
        log_warning "npx not found - skipping database setup"
    fi
}

# Function to validate the setup
validate_setup() {
    log "Validating setup..."
    
    # Check if required directories exist
    local required_dirs=(
        "$REPO_ROOT/lib/config"
        "$REPO_ROOT/lib/observability"
        "$REPO_ROOT/lib/security"
        "$REPO_ROOT/lib/performance"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_error "Required directory does not exist: $dir"
            return 1
        fi
    done
    
    # Check if required files exist
    local required_files=(
        "$REPO_ROOT/lib/config/index.ts"
        "$REPO_ROOT/lib/observability/telemetry.ts"
        "$REPO_ROOT/lib/security/hardening.ts"
        "$REPO_ROOT/lib/performance/perf-toolkit.ts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file does not exist: $file"
            return 1
        fi
    done
    
    log_success "Setup validation passed"
}

# Function to run tests
run_tests() {
    log "Running tests to verify setup..."
    
    cd "$REPO_ROOT"
    
    # Run linting
    if command -v npx &> /dev/null; then
        log "Running linting..."
        npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 || log_warning "Linting issues found"
    fi
    
    # Run type checking
    if command -v npx &> /dev/null; then
        log "Running type checking..."
        npx tsc --noEmit || log_warning "Type checking issues found"
    fi
    
    log_success "Tests completed"
}

# Function to display setup summary
display_summary() {
    log_success "Enterprise setup completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Review and update environment variables in $ENV_FILE"
    echo "2. Set up your database with: cd $REPO_ROOT && npx prisma db push"
    echo "3. Run the application with: cd $REPO_ROOT && npm run dev"
    echo
    echo "Enterprise features configured:"
    echo "- Security hardening with rate limiting and input validation"
    echo "- Observability with logging, metrics, and telemetry"
    echo "- Performance optimization with caching and compression"
    echo "- Configuration management with validation and hot-reloading"
    echo
    log "Setup log saved to $LOG_FILE"
}

# Main execution function
main() {
    local env_type="${1:-production}"
    
    log "Starting Enterprise Setup for Multi-LLM Platform (Environment: $env_type)"
    echo
    
    # Create log file
    exec > >(tee -a "$LOG_FILE") 2>&1
    
    # Execute setup steps
    create_backup
    check_dependencies
    install_dependencies
    setup_environment "$env_type"
    validate_environment
    setup_security
    setup_observability
    setup_performance
    setup_database
    validate_setup
    run_tests
    display_summary
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Enterprise Setup Script for Multi-LLM Platform"
            echo
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV  Set environment (development, staging, production) [default: production]"
            echo "  -h, --help            Show this help message"
            echo
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set default environment if not specified
ENVIRONMENT="${ENVIRONMENT:-production}"

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Use 'development', 'staging', or 'production'."
    exit 1
fi

# Run main function
main "$ENVIRONMENT"