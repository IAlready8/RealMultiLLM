#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Running Security Audit...${NC}"

# Check for ENCRYPTION_MASTER_KEY
if [ -z "$ENCRYPTION_MASTER_KEY" ]; then
  echo -e "${RED}ENCRYPTION_MASTER_KEY is not set. Please set it to a secure value.${NC}"
  exit 1
fi

# Check for hardcoded secrets
echo "Scanning for hardcoded secrets..."
if grep -r -E "(sk-[a-zA-Z0-9]{20,}|api_key|password|secret)" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . > /dev/null; then
  echo -e "${RED}Potential hardcoded secrets found. Please remove them.${NC}"
  exit 1
fi

# Check for dependency vulnerabilities
echo "Checking for dependency vulnerabilities..."
if ! npm audit --audit-level=high; then
  echo -e "${RED}High-severity vulnerabilities found. Please run 'npm audit fix' to address them.${NC}"
  exit 1
fi

echo -e "${GREEN}Security audit passed.${NC}"
