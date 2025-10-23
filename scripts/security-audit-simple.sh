#!/bin/bash

# Simplified Security Audit Script for macOS compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SECURITY AUDIT (SIMPLIFIED)                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check for hardcoded secrets
echo "🔍 Scanning for hardcoded secrets..."
SECRETS_FOUND=$(grep -r "sk-[a-zA-Z0-9]*\|api-[a-zA-Z0-9]*\|password\|secret" "$PROJECT_ROOT" \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=.next \
    --include="*.js" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.json" \
    --include="*.env*" \
    --include="*.md" 2>/dev/null | wc -l)

if [ "$SECRETS_FOUND" -gt 0 ]; then
    echo -e "${RED}[ERROR]${NC} $SECRETS_FOUND potential hardcoded secrets found"
else
    echo -e "${GREEN}[SUCCESS]${NC} No obvious hardcoded secrets detected"
fi

# Check if .env files have proper permissions
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    if [ "$(stat -f %OLp "$PROJECT_ROOT/.env.local" 2>/dev/null || stat -c %a "$PROJECT_ROOT/.env.local" 2>/dev/null)" = "600" ]; then
        echo -e "${GREEN}[SUCCESS]${NC} .env.local has secure permissions (600)"
    else
        echo -e "${YELLOW}[WARNING]${NC} .env.local permissions should be 600 for security"
    fi
else
    echo -e "${YELLOW}[INFO]${NC} .env.local not found"
fi

# Check if dependencies have known vulnerabilities
if command -v npm >/dev/null 2>&1; then
    echo "📦 Checking for dependency vulnerabilities..."
    if npm audit --audit-level high >/dev/null 2>&1; then
        echo -e "${GREEN}[SUCCESS]${NC} No high/critical vulnerabilities found"
    else
        echo -e "${YELLOW}[WARNING]${NC} Vulnerabilities detected - run: npm audit"
    fi
else
    echo -e "${YELLOW}[WARNING]${NC} npm not available to check vulnerabilities"
fi

echo ""
echo -e "${GREEN}✅ Security audit completed${NC}"
echo ""
echo "For comprehensive security, consider:"
echo "- Using dedicated tools like npm audit, snyk, or OWASP ZAP"
echo "- Regular dependency updates"
echo "- Penetration testing"