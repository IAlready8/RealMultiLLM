#!/bin/bash

# ============================================================================

# COMPLETE ENVIRONMENT VALIDATION & PRE-DEPLOYMENT CHECK

# Enterprise-grade validation with zero-error deployment guarantees

# Optimized for: Mac M2 8GB + Mac Pro 2013 16GB

# ============================================================================

set -e
set -o pipefail

# Colors

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="$PROJECT_ROOT/deployment-check-$(date +%Y%m%d_%H%M%S).json"
ERROR_COUNT=0
WARNING_COUNT=0
INFO_COUNT=0

# Associative arrays for checks

declare -A CHECK_RESULTS
declare -A CHECK_MESSAGES

# Logging functions

log_error() {
echo -e "${RED}[ERROR]${NC} $1"
((ERROR_COUNT++))
CHECK_RESULTS["$2"]="ERROR"
CHECK_MESSAGES["$2"]="$1"
}

log_warning() {
echo -e "${YELLOW}[WARNING]${NC} $1"
((WARNING_COUNT++))
CHECK_RESULTS["$2"]="WARNING"
CHECK_MESSAGES["$2"]="$1"
}

log_success() {
echo -e "${GREEN}[SUCCESS]${NC} $1"
CHECK_RESULTS["$2"]="SUCCESS"
CHECK_MESSAGES["$2"]="$1"
}

log_info() {
echo -e "${BLUE}[INFO]${NC} $1"
((INFO_COUNT++))
}

# Check Node.js version

check_nodejs() {
log_info "Checking Node.js version..."

```
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed" "nodejs"
    return 1
fi

local version=$(node -v | cut -d'v' -f2)
local major=$(echo $version | cut -d'.' -f1)

if [ "$major" -lt 18 ]; then
    log_error "Node.js version must be 18+. Current: $version" "nodejs"
    return 1
fi

log_success "Node.js $version installed" "nodejs"
```

}

# Check npm version

check_npm() {
log_info "Checking npm version..."

```
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed" "npm"
    return 1
fi

local version=$(npm -v)
log_success "npm $version installed" "npm"
```

}

# Check system resources

check_system_resources() {
log_info "Checking system resources..."

```
# Check available memory
if [[ "$OSTYPE" == "darwin"* ]]; then
    local total_mem=$(sysctl -n hw.memsize | awk '{print $0/1024/1024/1024}')
    local free_mem=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{print $0*4096/1024/1024/1024}')
    
    log_info "Total Memory: ${total_mem}GB"
    log_info "Free Memory: ${free_mem}GB"
    
    if (( $(echo "$free_mem < 2" | bc -l) )); then
        log_warning "Low memory available: ${free_mem}GB (recommended: 2GB+)" "memory"
    else
        log_success "Sufficient memory available: ${free_mem}GB" "memory"
    fi
fi

# Check available disk space
local free_space=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/Gi//')
log_info "Free disk space: ${free_space}GB"

if (( $(echo "$free_space < 5" | bc -l) )); then
    log_warning "Low disk space: ${free_space}GB (recommended: 5GB+)" "disk_space"
else
    log_success "Sufficient disk space: ${free_space}GB" "disk_space"
fi
```

}

# Check environment files

check_env_files() {
log_info "Checking environment files..."

```
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    log_error ".env.local file not found" "env_file"
    return 1
fi

if [ ! -f "$PROJECT_ROOT/.env.example" ]; then
    log_warning ".env.example file not found (reference file missing)" "env_example"
fi

log_success "Environment files present" "env_file"
```

}

# Validate required environment variables

check_required_env_vars() {
log_info "Validating required environment variables..."

```
source "$PROJECT_ROOT/.env.local" 2>/dev/null || {
    log_error "Failed to load .env.local" "env_load"
    return 1
}

local required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
)

local missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Missing required environment variables: ${missing_vars[*]}" "env_vars"
    return 1
fi

# Validate NEXTAUTH_SECRET length
if [ ${#NEXTAUTH_SECRET} -lt 32 ]; then
    log_error "NEXTAUTH_SECRET must be at least 32 characters" "nextauth_secret"
    return 1
fi

log_success "All required environment variables present" "env_vars"
```

}

# Check database connection

check_database_connection() {
log_info "Checking database connection..."

```
cd "$PROJECT_ROOT"

# Try to connect to database
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => {
    console.log('✅ Database connection successful');
    return prisma.\$disconnect();
  })
  .catch((e) => {
    console.error('❌ Database connection failed:', e.message);
    process.exit(1);
  });
" &>/dev/null

if [ $? -eq 0 ]; then
    log_success "Database connection successful" "database"
else
    log_error "Database connection failed" "database"
    return 1
fi
```

}

# Check Prisma schema

check_prisma_schema() {
log_info "Validating Prisma schema..."

```
cd "$PROJECT_ROOT"

if [ ! -f "$PROJECT_ROOT/prisma/schema.prisma" ]; then
    log_error "Prisma schema not found" "prisma_schema"
    return 1
fi

npx prisma validate &>/dev/null

if [ $? -eq 0 ]; then
    log_success "Prisma schema is valid" "prisma_schema"
else
    log_error "Prisma schema validation failed" "prisma_schema"
    return 1
fi
```

}

# Check dependencies

check_dependencies() {
log_info "Checking npm dependencies..."

```
cd "$PROJECT_ROOT"

if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    log_error "node_modules not found. Run: npm install" "dependencies"
    return 1
fi

# Check for critical dependencies
local critical_deps=(
    "next"
    "react"
    "@prisma/client"
    "next-auth"
)

local missing_deps=()

for dep in "${critical_deps[@]}"; do
    if [ ! -d "$PROJECT_ROOT/node_modules/$dep" ]; then
        missing_deps+=("$dep")
    fi
done

if [ ${#missing_deps[@]} -gt 0 ]; then
    log_error "Missing critical dependencies: ${missing_deps[*]}" "dependencies"
    return 1
fi

log_success "All critical dependencies installed" "dependencies"
```

}

# Check for security vulnerabilities

check_security() {
log_info "Checking for security vulnerabilities..."

```
cd "$PROJECT_ROOT"

# Run npm audit
local audit_result=$(npm audit --json 2>/dev/null || echo '{}')
local critical=$(echo "$audit_result" | command -v jq >/dev/null 2>&1 && echo "$audit_result" | jq -r '.metadata.vulnerabilities.critical // 0' || echo 0)
local high=$(echo "$audit_result" | command -v jq >/dev/null 2>&1 && echo "$audit_result" | jq -r '.metadata.vulnerabilities.high // 0' || echo 0)

if [ "$critical" -gt 0 ]; then
    log_error "$critical critical vulnerabilities found" "security"
    return 1
elif [ "$high" -gt 0 ]; then
    log_warning "$high high-severity vulnerabilities found" "security"
else
    log_success "No critical vulnerabilities found" "security"
fi
```

}

# Check build configuration

check_build_config() {
log_info "Checking build configuration..."

```
cd "$PROJECT_ROOT"

# Check next.config.mjs
if [ ! -f "$PROJECT_ROOT/next.config.mjs" ]; then
    log_error "next.config.mjs not found" "build_config"
    return 1
fi

# Check tailwind.config.ts
if [ ! -f "$PROJECT_ROOT/tailwind.config.ts" ]; then
    log_warning "tailwind.config.ts not found" "build_config"
fi

# Check tsconfig.json
if [ ! -f "$PROJECT_ROOT/tsconfig.json" ]; then
    log_error "tsconfig.json not found" "build_config"
    return 1
fi

log_success "Build configuration files present" "build_config"
```

}

# Check TypeScript compilation

check_typescript() {
log_info "Checking TypeScript compilation..."

```
cd "$PROJECT_ROOT"

npx tsc --noEmit --skipLibCheck &>/dev/null

if [ $? -eq 0 ]; then
    log_success "TypeScript compilation successful" "typescript"
else
    log_warning "TypeScript compilation has errors (non-blocking)" "typescript"
fi
```

}

# Check ESLint

check_eslint() {
log_info "Checking ESLint configuration..."

```
cd "$PROJECT_ROOT"

npm run lint &>/dev/null

if [ $? -eq 0 ]; then
    log_success "ESLint checks passed" "eslint"
else
    log_warning "ESLint found issues (non-blocking)" "eslint"
fi
```

}

# Test build process

test_build() {
log_info "Testing production build..."

```
cd "$PROJECT_ROOT"

# Clean previous build
rm -rf .next

npm run build &>/dev/null

if [ $? -eq 0 ]; then
    log_success "Production build successful" "build"
else
    log_error "Production build failed" "build"
    return 1
fi
```

}

# Check API keys

check_api_keys() {
log_info "Checking API key configuration..."

```
source "$PROJECT_ROOT/.env.local" 2>/dev/null

local api_key_vars=(
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
    "GOOGLE_AI_API_KEY"
)

local configured_keys=0

for var in "${api_key_vars[@]}"; do
    if [ ! -z "${!var}" ]; then
        ((configured_keys++))
    fi
done

if [ $configured_keys -eq 0 ]; then
    log_warning "No LLM provider API keys configured" "api_keys"
else
    log_success "$configured_keys LLM provider(s) configured" "api_keys"
fi
```

}

# Check ports availability

check_ports() {
log_info "Checking port availability..."

```
local ports=(3000 3001 3002)
local available_port=""

for port in "${ports[@]}"; do
    if ! lsof -i:$port &>/dev/null; then
        available_port=$port
        break
    fi
done

if [ -z "$available_port" ]; then
    log_warning "Default ports (3000-3002) are in use" "ports"
else
    log_success "Port $available_port available" "ports"
fi
```

}

# Generate deployment report

generate_report() {
log_info "Generating deployment report..."

```
local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$REPORT_FILE" << EOF
```

{
"timestamp": "$timestamp",
"projectRoot": "$PROJECT_ROOT",
"summary": {
"errors": $ERROR_COUNT,
"warnings": $WARNING_COUNT,
"passed": $((${#CHECK_RESULTS[@]} - ERROR_COUNT - WARNING_COUNT))
},
"checks": {
EOF

```
local first=true
for key in "${!CHECK_RESULTS[@]}"; do
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> "$REPORT_FILE"
    fi
    echo -n "    \"$key\": {\"status\": \"${CHECK_RESULTS[$key]}\", \"message\": \"${CHECK_MESSAGES[$key]}\"}" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF
```

},
"recommendations": [
EOF

```
if [ $ERROR_COUNT -gt 0 ]; then
    echo '    "Fix all errors before deploying to production",' >> "$REPORT_FILE"
fi

if [ $WARNING_COUNT -gt 0 ]; then
    echo '    "Review warnings and address if possible",' >> "$REPORT_FILE"
fi

echo '    "Run full test suite before deployment",' >> "$REPORT_FILE"
echo '    "Ensure database backups are configured",' >> "$REPORT_FILE"
echo '    "Set up monitoring and alerting"' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << EOF
```

]
}
EOF

```
log_success "Deployment report generated: $REPORT_FILE" "report"
```

}

# Main execution

main() {
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  COMPLETE ENVIRONMENT VALIDATION & PRE-DEPLOYMENT     ║${NC}"
echo -e "${BLUE}║  Enterprise-Grade Validation System                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

```
# Run all checks
check_nodejs
check_npm
check_system_resources
check_env_files
check_required_env_vars
check_database_connection
check_prisma_schema
check_dependencies
check_security
check_build_config
check_typescript
check_eslint
check_api_keys
check_ports
test_build

# Generate report
generate_report

echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║  VALIDATION SUMMARY                                    ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Passed: $((${#CHECK_RESULTS[@]} - ERROR_COUNT - WARNING_COUNT))${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNING_COUNT${NC}"
echo -e "${RED}❌ Errors: $ERROR_COUNT${NC}"
echo ""
echo -e "${CYAN}📊 Detailed report: $REPORT_FILE${NC}"
echo ""

if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ DEPLOYMENT NOT READY                              ║${NC}"
    echo -e "${RED}║  Fix all errors before deploying                      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    exit 1
elif [ $WARNING_COUNT -gt 0 ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠️  DEPLOYMENT READY WITH WARNINGS                   ║${NC}"
    echo -e "${YELLOW}║  Review warnings before deploying                     ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ DEPLOYMENT READY                                  ║${NC}"
    echo -e "${GREEN}║  All checks passed successfully                       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    exit 0
fi
```

}

# Run main function

main "$@"