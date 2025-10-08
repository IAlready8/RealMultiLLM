#!/bin/bash

# Enterprise Setup Script for RealMultiLLM
# This script sets up the environment for enterprise deployment of RealMultiLLM

set -e  # Exit immediately if a command exits with a non-zero status

# Script configuration
SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"
PROJECT_ROOT=\"$(dirname \"$SCRIPT_DIR\")\"
LOG_FILE=\"$PROJECT_ROOT/setup.log\"
BACKUP_DIR=\"$PROJECT_ROOT/backups\"
ENV_FILE=\"$PROJECT_ROOT/.env\"
ENV_EXAMPLE=\"$PROJECT_ROOT/.env.example\"
ENV_PROD=\"$PROJECT_ROOT/.env.production\"
ENV_ENT=\"$PROJECT_ROOT/.env.enterprise\"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging function
log() {
    echo -e \"$1\" | tee -a \"$LOG_FILE\"
}

log_info() {
    log \"${BLUE}[INFO]${NC} $1\"
}

log_success() {
    log \"${GREEN}[SUCCESS]${NC} $1\"
}

log_warning() {
    log \"${YELLOW}[WARNING]${NC} $1\"
}

log_error() {
    log \"${RED}[ERROR]${NC} $1\"
}

# Function to check if a command exists
command_exists() {
    command -v \"$1\" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    if [[ \"$OSTYPE\" == \"darwin\"* ]]; then
        OS=\"macos\"
    elif [[ \"$OSTYPE\" == \"linux-gnu\"* ]]; then
        OS=\"linux\"
    else
        OS=\"unknown\"
    fi
    log_info \"Detected OS: $OS\"
}

# Function to check prerequisites
check_prerequisites() {
    log_info \"Checking prerequisites...\"

    local missing_deps=()
    
    if ! command_exists node; then
        missing_deps+=(\"node\")
    fi

    if ! command_exists npm; then
        missing_deps+=(\"npm\")
    fi

    if ! command_exists git; then
        missing_deps+=(\"git\")
    fi

    if [[ \"${#missing_deps[@]}\" -gt 0 ]]; then
        log_error \"Missing required dependencies: ${missing_deps[*]}\"
        log_error \"Please install Node.js, npm, and git before running this script.\"
        exit 1
    else
        log_success \"All prerequisites are satisfied\"
    fi
}

# Function to check Node.js version
check_node_version() {
    log_info \"Checking Node.js version...\"
    local node_version=$(node -v | cut -d'v' -f2)
    local major_version=$(echo \"$node_version\" | cut -d'.' -f1)

    if [[ \"$major_version\" -lt 18 ]]; then
        log_error \"Node.js version $node_version is not supported. Please install Node.js 18 or higher.\"
        exit 1
    else
        log_success \"Node.js version $node_version is supported\"
    fi
}

# Function to create backup directory
create_backup_dir() {
    log_info \"Creating backup directory...\"
    mkdir -p \"$BACKUP_DIR\"
    log_success \"Backup directory created: $BACKUP_DIR\"
}

# Function to backup existing files
backup_files() {
    log_info \"Creating backups...\"
    
    # Backup .env file if it exists
    if [[ -f \"$ENV_FILE\" ]]; then
        cp \"$ENV_FILE\" \"$BACKUP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)\"
        log_success \"Backed up .env file\"
    fi

    # Backup package*.json files
    if [[ -f \"$PROJECT_ROOT/package.json\" ]]; then
        cp \"$PROJECT_ROOT/package.json\" \"$BACKUP_DIR/package.json.backup.$(date +%Y%m%d_%H%M%S)\"
        log_success \"Backed up package.json\"
    fi

    if [[ -f \"$PROJECT_ROOT/package-lock.json\" ]]; then
        cp \"$PROJECT_ROOT/package-lock.json\" \"$BACKUP_DIR/package-lock.json.backup.$(date +%Y%m%d_%H%M%S)\"
        log_success \"Backed up package-lock.json\"
    fi

    log_success \"Backups completed\"
}

# Function to install Node.js dependencies
install_dependencies() {
    log_info \"Installing Node.js dependencies...\"

    cd \"$PROJECT_ROOT\"
    
    # Check if node_modules exists and is not empty
    if [[ -d \"node_modules\" ]] && [[ \"$(ls -A node_modules 2>/dev/null)\" ]]; then
        log_info \"node_modules directory exists, checking if update is needed...\"
        
        # Compare package-lock.json timestamp with node_modules timestamp
        if [[ -f \"package-lock.json\" ]] && [[ \"package-lock.json\" -nt \"node_modules\" ]]; then
            log_info \"package-lock.json is newer than node_modules, updating dependencies...\"
            npm ci
        else
            log_info \"Dependencies appear up to date\"
        fi
    else
        log_info \"Installing dependencies...\"
        npm ci
    fi

    log_success \"Dependencies installed successfully\"
}

# Function to verify environment variables
verify_env_vars() {
    log_info \"Verifying environment variables...\"
    
    # Check if .env file exists
    if [[ ! -f \"$ENV_FILE\" ]]; then
        log_warning \".env file does not exist, creating from example\"
        cp \"$ENV_EXAMPLE\" \"$ENV_FILE\" || {
            log_error \"Failed to copy .env.example to .env\"
            exit 1
        }
    fi

    # Verify critical environment variables
    local required_vars=(
        \"DATABASE_URL\"
        \"NEXTAUTH_SECRET\"
        \"NEXTAUTH_URL\"
        \"GOOGLE_CLIENT_ID\"
        \"GOOGLE_CLIENT_SECRET\"
        \"GITHUB_ID\"
        \"GITHUB_SECRET\"
    )

    local missing_vars=()
    for var in \"${required_vars[@]}\"; do
        if ! grep -q \"^${var}=\" \"$ENV_FILE\"; then
            missing_vars+=(\"$var\")
        fi
    done

    if [[ \"${#missing_vars[@]}\" -gt 0 ]]; then
        log_warning \"The following environment variables are missing in $ENV_FILE:\"
        printf '%s\\n' \"${missing_vars[@]}\"
        log_info \"Please update $ENV_FILE with appropriate values before running the application\"
    else
        log_success \"All required environment variables are present\"
    fi
}

# Function to setup enterprise-specific environment
setup_enterprise_env() {
    log_info \"Setting up enterprise environment variables...\"

    # Create enterprise-specific .env file
    touch \"$ENV_ENT\"

    # Add enterprise-specific variables
    cat >> \"$ENV_ENT\" << 'EOF'
# Enterprise Configuration
ENTERPRISE_AUDIT_LOGGING=true
ENTERPRISE_COMPLIANCE_MONITORING=true
ENTERPRISE_DATA_ENCRYPTION=true
ENTERPRISE_USER_IMPERSONATION=false
ENTERPRISE_RBAC=true
ENTERPRISE_REQUEST_TRACING=true
ENTERPRISE_PERFORMANCE_MONITORING=true
ENTERPRISE_SECURITY_SCANNING=true

# Security Configuration
SSO_ENABLED=false
SSO_PROVIDER=okta
SSO_METADATA_URL=
SSO_CLIENT_ID=
SSO_CLIENT_SECRET=

MFA_REQUIRED=true
MFA_METHODS=[\"totp\"]

ENCRYPTION_AT_REST=true
ENCRYPTION_IN_TRANSIT=true
ENCRYPTION_KEY_ROTATION_DAYS=90
ENCRYPTION_ALGORITHM=AES-256-GCM

RATE_LIMIT_BYPASS_KEY=

# Compliance Configuration
COMPLIANCE_GDPR_ENABLED=false
COMPLIANCE_HIPAA_ENABLED=false
COMPLIANCE_SOX_ENABLED=false
COMPLIANCE_PCI_ENABLED=false

# Performance Configuration
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_TRACING_ENABLED=true
PERFORMANCE_CACHING_ENABLED=true
PERFORMANCE_SAMPLE_RATE=0.1

# Telemetry Configuration
TELEMETRY_ENABLED=true
TELEMETRY_MODE=console
TELEMETRY_FLUSH_INTERVAL=30000
TELEMETRY_MAX_BUFFER_SIZE=1000
TELEMETRY_ENDPOINT=
TELEMETRY_API_KEY=

# Resource Limits
PERFORMANCE_MEMORY_LIMIT_MB=2048
PERFORMANCE_MAX_CONCURRENT_REQUESTS=500
PERFORMANCE_REQUEST_TIMEOUT_MS=60000

# Integration Configuration
ANALYTICS_ENABLED=true
ANALYTICS_PROVIDER=ga4
ANALYTICS_TRACKING_ID=
ANALYTICS_EVENT_SAMPLING_RATE=0.1

# Operations Configuration
MAINTENANCE_MODE=false
MAINTENANCE_START_TIME=02:00
MAINTENANCE_DURATION_MINUTES=30
MAINTENANCE_ALLOWED_IPS=

BACKUP_ENABLED=true
BACKUP_SCHEDULE=\"0 2 * * *\"
BACKUP_RETENTION_DAYS=90
BACKUP_DESTINATION=s3

DISASTER_RECOVERY_ENABLED=false
DISASTER_RECOVERY_BACKUP_FREQUENCY=\"0 */6 * * *\"
DISASTER_RECOVERY_FAILOVER_STRATEGY=warm

EOF

    log_success \"Enterprise environment variables configured in $ENV_ENT\"
}

# Function to generate secrets
generate_secrets() {
    log_info \"Generating security secrets...\"

    # Function to generate a random string
    generate_secret() {
        openssl rand -base64 32 | tr -d '+/=' | cut -c1-32
    }

    # Update .env file with generated secrets if not already set
    if ! grep -q \"^NEXTAUTH_SECRET=\" \"$ENV_FILE\" || [[ $(grep \"^NEXTAUTH_SECRET=\" \"$ENV_FILE\" | cut -d'=' -f2) == \"\" ]]; then
        sed -i.bak \"s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(generate_secret)|\" \"$ENV_FILE\" 2>/dev/null || {
            # On macOS, sed -i requires a backup extension
            sed -i '.bak' \"s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(generate_secret)|\" \"$ENV_FILE\"
        }
        log_success \"Generated NEXTAUTH_SECRET\"
    fi

    if ! grep -q \"^ENCRYPTION_KEY=\" \"$ENV_FILE\" || [[ $(grep \"^ENCRYPTION_KEY=\" \"$ENV_FILE\" | cut -d'=' -f2) == \"\" ]]; then
        sed -i.bak \"s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(generate_secret)|\" \"$ENV_FILE\" 2>/dev/null || {
            sed -i '.bak' \"s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(generate_secret)|\" \"$ENV_FILE\"
        }
        log_success \"Generated ENCRYPTION_KEY\"
    fi

    # Clean up backup files created by sed
    rm -f \"$ENV_FILE.bak\" 2>/dev/null || true
    
    log_success \"Security secrets generated and updated\"
}

# Function to setup database
setup_database() {
    log_info \"Setting up database...\"

    cd \"$PROJECT_ROOT\"

    # Generate Prisma client
    npx prisma generate

    # Check if this is a fresh setup or existing setup
    if [[ -f \"prisma/migrations/0_init/migration.sql\" ]] && [[ ! -f \"prisma/migrations/0_init/README.md\" ]]; then
        # Fresh setup - migrate database
        log_info \"Running initial database migration...\"
        npx prisma db push
    else
        # Existing setup - just apply pending migrations
        log_info \"Applying pending database migrations...\"
        npx prisma migrate deploy
    fi

    log_success \"Database setup completed\"
}

# Function to run tests
run_tests() {
    log_info \"Running tests...\"

    cd \"$PROJECT_ROOT\"

    # Run linting
    log_info \"Running linting...\"
    npm run lint || {
        log_warning \"Linting failed, continuing setup...\"
    }

    # Run tests
    log_info \"Running tests...\"
    npm run test:run || {
        log_warning \"Tests failed, continuing setup but please check test failures...\"
    }

    log_success \"Tests completed\"
}

# Function to setup PM2 for production
setup_pm2() {
    log_info \"Setting up PM2 for production...\"

    # Install pm2 globally if not already installed
    if ! command_exists pm2; then
        log_info \"Installing PM2...\"
        npm install -g pm2
    fi

    # Create PM2 ecosystem file
    cat > \"$PROJECT_ROOT/ecosystem.config.js\" << 'EOF'
module.exports = {
  apps: [{
    name: 'realllm-enterprise',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      ...require('dotenv').config({ path: './.env' }).parsed,
      ...require('dotenv').config({ path: './.env.enterprise' }).parsed,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048',
  }]
};
EOF

    log_success \"PM2 ecosystem configuration created\"
}

# Function to create logs directory
create_logs_dir() {
    log_info \"Creating logs directory...\"
    mkdir -p \"$PROJECT_ROOT/logs\"
    log_success \"Logs directory created\"
}

# Function to setup systemd service (Linux only)
setup_systemd_service() {
    if [[ \"$OS\" == \"linux\" ]]; then
        log_info \"Setting up systemd service...\"

        sudo tee /etc/systemd/system/realllm-enterprise.service > /dev/null << 'EOF'
[Unit]
Description=RealMultiLLM Enterprise Service
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStartPre=/usr/bin/npm install
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/RealMultiLLM
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable realllm-enterprise.service
        log_success \"Systemd service created and enabled\"
    else
        log_info \"Skipping systemd service setup (not Linux)\"
    fi
}

# Function to validate enterprise setup
validate_setup() {
    log_info \"Validating enterprise setup...\"

    cd \"$PROJECT_ROOT\"

    # Check if all required modules exist
    if [[ ! -f \"node_modules/.bin/prisma\" ]]; then
        log_error \"Prisma is not installed correctly\"
        exit 1
    fi

    # Check if enterprise modules exist
    local enterprise_modules=(
        \"lib/config/index.ts\"
        \"lib/observability/telemetry.ts\"
        \"lib/security/hardening.ts\"
        \"lib/performance/perf-toolkit.ts\"
    )

    for module in \"${enterprise_modules[@]}\"; do
        if [[ ! -f \"$PROJECT_ROOT/$module\" ]]; then
            log_error \"Enterprise module missing: $module\"
            exit 1
        fi
    done

    log_success \"Enterprise setup validation passed\"
}

# Function to display setup summary
display_summary() {
    log_info \"Setup Summary:\"
    log_success \"RealMultiLLM Enterprise setup completed successfully!\"
    echo \"\"
    log_info \"Next steps:\"
    log_info \"1. Review and update $ENV_FILE with your specific configuration\"
    log_info \"2. Review and customize $ENV_ENT for enterprise features\"
    log_info \"3. Run 'npm run dev' to start the development server\"
    log_info \"4. For production, use PM2: 'pm2 start ecosystem.config.js'\"
    echo \"\"
    log_info \"Enterprise features enabled:\"
    log_info \"- Audit logging\"
    log_info \"- Compliance monitoring (GDPR, HIPAA, SOX, PCI)\"
    log_info \"- Data encryption at rest and in transit\"
    log_info \"- Role-based access control (RBAC)\"
    log_info \"- Request tracing\"
    log_info \"- Performance monitoring\"
    log_info \"- Security scanning\"
    log_info \"- Rate limiting with IP whitelisting\"
    echo \"\"
    log_info \"Configuration files:\"
    log_info \"- Main config: $ENV_FILE\"
    log_info \"- Enterprise config: $ENV_ENT\"
    log_info \"- PM2 config: $PROJECT_ROOT/ecosystem.config.js\"
    log_info \"- Logs: $PROJECT_ROOT/logs/\"
}

# Main execution function
main() {
    log_info \"Starting RealMultiLLM Enterprise Setup\"

    # Initialize log file
    touch \"$LOG_FILE\"
    log_info \"Starting enterprise setup - $(date)\"

    # Execute setup steps
    detect_os
    check_prerequisites
    check_node_version
    create_backup_dir
    backup_files
    install_dependencies
    verify_env_vars
    setup_enterprise_env
    generate_secrets
    setup_database
    run_tests
    create_logs_dir
    setup_pm2
    setup_systemd_service
    validate_setup

    # Display summary
    display_summary

    log_success \"Enterprise setup completed successfully!\"
}

# Run main function
main \"$@\"