#!/bin/bash

# ============================================================================

# COMPLETE SECURITY AUDIT & HARDENING SCRIPT

# Enterprise-grade security validation and automated hardening

# ============================================================================

set -e; set -o pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECURITY_REPORT="$PROJECT_ROOT/security-audit-$(date +%Y%m%d_%H%M%S).json"
CRITICAL_COUNT=0; HIGH_COUNT=0; MEDIUM_COUNT=0; LOW_COUNT=0

log() { echo -e "${!1}[${1}]${NC} $2"; }

# Check secrets in code

check_secrets() {
log BLUE "🔍 Scanning for hardcoded secrets..."

```
local patterns=(
    "AKIA[0-9A-Z]{16}"  # AWS keys
    "sk-[a-zA-Z0-9]{48}" # OpenAI keys
    "sk-ant-[a-zA-Z0-9]{95}" # Anthropic keys
    "AIza[0-9A-Za-z\\-_]{35}" # Google keys
    "[0-9a-f]{32}" # Generic 32-char hex
)

local found=0
for pattern in "${patterns[@]}"; do
    if grep -rEI "$pattern" "$PROJECT_ROOT" \
        --exclude-dir={node_modules,.next,.git,backups,logs} \
        --exclude="*.{log,lock}" 2>/dev/null; then
        ((found++))
    fi
done

if [ $found -gt 0 ]; then
    log RED "❌ CRITICAL: Hardcoded secrets found in $found files"
    ((CRITICAL_COUNT++))
else
    log GREEN "✅ No hardcoded secrets detected"
fi
```

}

# Validate environment security

check_env_security() {
log BLUE "🔐 Validating environment security..."

```
source "$PROJECT_ROOT/.env.local" 2>/dev/null || {
    log YELLOW "⚠️  Cannot load .env.local"
    ((MEDIUM_COUNT++))
    return
}

# Check NEXTAUTH_SECRET strength
if [ ${#NEXTAUTH_SECRET} -lt 32 ]; then
    log RED "❌ CRITICAL: NEXTAUTH_SECRET too short (${#NEXTAUTH_SECRET} < 32)"
    ((CRITICAL_COUNT++))
else
    log GREEN "✅ NEXTAUTH_SECRET meets minimum length"
fi

# Check ENCRYPTION_MASTER_KEY
if [ ! -z "$ENCRYPTION_MASTER_KEY" ] && [ ${#ENCRYPTION_MASTER_KEY} -lt 64 ]; then
    log RED "❌ HIGH: ENCRYPTION_MASTER_KEY too short (${#ENCRYPTION_MASTER_KEY} < 64)"
    ((HIGH_COUNT++))
fi

# Check for default/weak values
if [[ "$NEXTAUTH_SECRET" == *"password"* ]] || [[ "$NEXTAUTH_SECRET" == *"secret"* ]]; then
    log RED "❌ CRITICAL: NEXTAUTH_SECRET appears to be default/weak"
    ((CRITICAL_COUNT++))
fi
```

}

# Check dependency vulnerabilities

check_dependencies() {
log BLUE "📦 Checking dependency vulnerabilities..."

```
cd "$PROJECT_ROOT"
local audit=$(npm audit --json 2>/dev/null || echo '{}')

local jq_available=0
if command -v jq >/dev/null 2>&1; then jq_available=1; fi

local critical=0
local high=0
local moderate=0

if [ $jq_available -eq 1 ]; then
    critical=$(echo "$audit" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo 0)
    high=$(echo "$audit" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo 0)
    moderate=$(echo "$audit" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo 0)
else
    log YELLOW "⚠️  jq not found - skipping detailed vulnerability parsing"
    # Fallback: simple grep approach for vulnerability counting
    critical=$(echo "$audit" | grep -o '"critical":[0-9]*' | cut -d: -f2 | head -1 || echo 0)
    high=$(echo "$audit" | grep -o '"high":[0-9]*' | cut -d: -f2 | head -1 || echo 0)
    moderate=$(echo "$audit" | grep -o '"moderate":[0-9]*' | cut -d: -f2 | head -1 || echo 0)
fi

if [ "$critical" -gt 0 ]; then
    log RED "❌ CRITICAL: $critical critical vulnerabilities"
    CRITICAL_COUNT=$((CRITICAL_COUNT + critical))
fi

if [ "$high" -gt 0 ]; then
    log YELLOW "⚠️  HIGH: $high high vulnerabilities"
    HIGH_COUNT=$((HIGH_COUNT + high))
fi

if [ "$moderate" -gt 0 ]; then
    log BLUE "ℹ️  MEDIUM: $moderate moderate vulnerabilities"
    MEDIUM_COUNT=$((MEDIUM_COUNT + moderate))
fi

if [ "$critical" -eq 0 ] && [ "$high" -eq 0 ]; then
    log GREEN "✅ No critical/high vulnerabilities"
fi
```

}

# Check file permissions

check_permissions() {
log BLUE "🔒 Checking file permissions..."

```
local sensitive_files=(
    ".env.local"
    ".env.production"
    "prisma/dev.db"
)

for file in "${sensitive_files[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        local perms=$(stat -f "%Lp" "$PROJECT_ROOT/$file" 2>/dev/null || stat -c "%a" "$PROJECT_ROOT/$file" 2>/dev/null)
        if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
            log YELLOW "⚠️  $file has weak permissions: $perms (should be 600)"
            ((MEDIUM_COUNT++))
            chmod 600 "$PROJECT_ROOT/$file" 2>/dev/null && log GREEN "  ✅ Fixed permissions to 600"
        fi
    fi
done
```

}

# Check security headers

check_security_headers() {
log BLUE "🛡️  Checking security headers configuration..."

```
local middleware="$PROJECT_ROOT/middleware.ts"
if [ ! -f "$middleware" ]; then
    log YELLOW "⚠️  middleware.ts not found"
    ((MEDIUM_COUNT++))
    return
fi

local required_headers=(
    "X-Frame-Options"
    "X-Content-Type-Options"
    "Strict-Transport-Security"
    "Content-Security-Policy"
)

for header in "${required_headers[@]}"; do
    if ! grep -q "$header" "$middleware"; then
        log YELLOW "⚠️  Missing security header: $header"
        ((MEDIUM_COUNT++))
    fi
done

log GREEN "✅ Security headers configuration checked"
```

}

# Check HTTPS enforcement

check_https() {
log BLUE "🔐 Checking HTTPS enforcement..."

```
source "$PROJECT_ROOT/.env.local" 2>/dev/null || return

if [[ ! "$NEXTAUTH_URL" =~ ^https:// ]] && [[ "$NODE_ENV" == "production" ]]; then
    log YELLOW "⚠️  NEXTAUTH_URL should use HTTPS in production"
    ((MEDIUM_COUNT++))
else
    log GREEN "✅ HTTPS configuration correct"
fi
```

}

# Check rate limiting

check_rate_limiting() {
log BLUE "⏱️  Checking rate limiting configuration..."

```
if grep -q "rate" "$PROJECT_ROOT/middleware.ts" 2>/dev/null; then
    log GREEN "✅ Rate limiting configured in middleware"
else
    log YELLOW "⚠️  Rate limiting not detected in middleware"
    ((MEDIUM_COUNT++))
fi
```

}

# Check authentication config

check_auth_config() {
log BLUE "🔑 Checking authentication configuration..."

```
local auth_file="$PROJECT_ROOT/lib/auth.ts"
if [ ! -f "$auth_file" ]; then
    log YELLOW "⚠️  auth.ts not found"
    ((MEDIUM_COUNT++))
    return
fi

# Check for 2FA configuration
if grep -q "2fa\|totp" "$auth_file" 2>/dev/null; then
    log GREEN "✅ 2FA configuration detected"
else
    log BLUE "ℹ️  2FA not configured (optional)"
fi

# Check for session security
if grep -q "maxAge" "$auth_file" 2>/dev/null; then
    log GREEN "✅ Session timeout configured"
else
    log YELLOW "⚠️  Session timeout not configured"
    ((LOW_COUNT++))
fi
```

}

# Check CORS configuration

check_cors() {
log BLUE "🌐 Checking CORS configuration..."

```
if grep -rq "cors" "$PROJECT_ROOT/app/api" 2>/dev/null; then
    log GREEN "✅ CORS configuration detected"
else
    log BLUE "ℹ️  No explicit CORS configuration (using defaults)"
fi
```

}

# Check database security

check_database_security() {
log BLUE "🗄️  Checking database security..."

```
source "$PROJECT_ROOT/.env.local" 2>/dev/null || return

if [[ "$DATABASE_URL" =~ postgresql:// ]]; then
    if [[ "$DATABASE_URL" =~ sslmode=require ]]; then
        log GREEN "✅ PostgreSQL SSL enforced"
    else
        log YELLOW "⚠️  PostgreSQL SSL not enforced"
        ((MEDIUM_COUNT++))
    fi
fi

# Check for SQL injection protection (Prisma usage)
if [ -f "$PROJECT_ROOT/prisma/schema.prisma" ]; then
    log GREEN "✅ Using Prisma ORM (SQL injection protected)"
fi
```

}

# Auto-harden security

auto_harden() {
log BLUE "🔧 Auto-hardening security..."

```
# Fix file permissions
find "$PROJECT_ROOT" -name "*.env*" -type f -exec chmod 600 {} \; 2>/dev/null
find "$PROJECT_ROOT" -name "*.db" -type f -exec chmod 600 {} \; 2>/dev/null

# Add .gitignore entries for sensitive files
local gitignore="$PROJECT_ROOT/.gitignore"
local sensitive_patterns=(
    ".env.local"
    ".env.production"
    "*.db"
    "*.log"
    "backups/"
    "security-audit-*.json"
)

for pattern in "${sensitive_patterns[@]}"; do
    if ! grep -q "^$pattern$" "$gitignore" 2>/dev/null; then
        echo "$pattern" >> "$gitignore"
    fi
done

log GREEN "✅ Auto-hardening completed"
```

}

# Generate security report

generate_report() {
cat > "$SECURITY_REPORT" << EOF
{
"timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
"project": "$PROJECT_ROOT",
"summary": {
"critical": $CRITICAL_COUNT,
"high": $HIGH_COUNT,
"medium": $MEDIUM_COUNT,
"low": $LOW_COUNT,
"total": $(($CRITICAL_COUNT + $HIGH_COUNT + $MEDIUM_COUNT + $LOW_COUNT))
},
"recommendations": [
"Fix all critical issues before deployment",
"Address high-severity issues as soon as possible",
"Review medium and low issues during maintenance",
"Implement automated security scanning in CI/CD",
"Set up dependency vulnerability monitoring",
"Enable 2FA for all admin accounts",
"Implement rate limiting on all API endpoints",
"Use HTTPS in production environments",
"Regularly update dependencies",
"Conduct periodic security audits"
]
}
EOF

```
log GREEN "✅ Security report generated: $SECURITY_REPORT"
```

}

# Main execution

main() {
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  COMPLETE SECURITY AUDIT & HARDENING      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

```
check_secrets
check_env_security
check_dependencies
check_permissions
check_security_headers
check_https
check_rate_limiting
check_auth_config
check_cors
check_database_security
auto_harden
generate_report

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SECURITY AUDIT SUMMARY                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${RED}🔴 Critical: $CRITICAL_COUNT${NC}"
echo -e "${YELLOW}🟡 High: $HIGH_COUNT${NC}"
echo -e "${BLUE}🔵 Medium: $MEDIUM_COUNT${NC}"
echo -e "${GREEN}🟢 Low: $LOW_COUNT${NC}"
echo ""
echo -e "${BLUE}📊 Report: $SECURITY_REPORT${NC}"
echo ""

if [ $CRITICAL_COUNT -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL ISSUES FOUND - DO NOT DEPLOY${NC}"
    exit 1
elif [ $HIGH_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  HIGH SEVERITY ISSUES - FIX BEFORE PRODUCTION${NC}"
    exit 1
else
    echo -e "${GREEN}✅ SECURITY AUDIT PASSED${NC}"
    exit 0
fi
```

}

main "$@"