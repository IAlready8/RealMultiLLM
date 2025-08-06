#!/bin/bash
# Environment Variable Validation Script
# Ensures all required environment variables are properly configured

# 3-STEP VALIDATION PLAN:
# 1. Check required environment variables
# 2. Validate format and security of sensitive values
# 3. Provide helpful error messages and suggestions

set -e

echo "🔍 Validating environment configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
ERRORS=0
WARNINGS=0

# Function to check if a variable is set and not empty
check_required() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ Missing required variable: $var_name${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

# Function to check optional variables
check_optional() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  Optional variable not set: $var_name${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

# Function to validate API key format
validate_api_key() {
    local var_name=$1
    local var_value=${!var_name}
    local prefix=$2
    local min_length=${3:-20}
    
    if [ -n "$var_value" ]; then
        if [[ ${#var_value} -lt $min_length ]]; then
            echo -e "${RED}❌ $var_name appears too short (less than $min_length characters)${NC}"
            ERRORS=$((ERRORS + 1))
        elif [[ -n "$prefix" && ! "$var_value" =~ ^$prefix ]]; then
            echo -e "${RED}❌ $var_value does not start with expected prefix '$prefix'${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

# Function to validate URL format
validate_url() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -n "$var_value" ]; then
        if [[ ! "$var_value" =~ ^https?:// ]]; then
            echo -e "${RED}❌ $var_name must be a valid URL starting with http:// or https://${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

echo "Checking required environment variables..."

# Core application variables
check_required "NEXTAUTH_SECRET"
if [ -n "$NEXTAUTH_SECRET" ]; then
    if [[ ${#NEXTAUTH_SECRET} -lt 32 ]]; then
        echo -e "${RED}❌ NEXTAUTH_SECRET should be at least 32 characters long${NC}"
        echo -e "${YELLOW}💡 Generate a secure secret with: openssl rand -base64 32${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Database configuration
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set, using default SQLite${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
    
    # Validate database URL format
    if [[ "$DATABASE_URL" =~ ^postgres:// ]] || [[ "$DATABASE_URL" =~ ^postgresql:// ]]; then
        echo -e "${GREEN}✅ PostgreSQL database detected${NC}"
    elif [[ "$DATABASE_URL" =~ ^file: ]]; then
        echo -e "${GREEN}✅ SQLite database detected${NC}"
    else
        echo -e "${YELLOW}⚠️  Unknown database URL format${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""
echo "Checking optional LLM API keys..."

# LLM API Keys (optional but recommended)
check_optional "OPENAI_API_KEY"
validate_api_key "OPENAI_API_KEY" "sk-" 40

check_optional "ANTHROPIC_API_KEY"
validate_api_key "ANTHROPIC_API_KEY" "" 20

check_optional "GOOGLE_AI_API_KEY"
validate_api_key "GOOGLE_AI_API_KEY" "" 20

check_optional "GROQ_API_KEY"
validate_api_key "GROQ_API_KEY" "gsk_" 20

check_optional "HUGGINGFACE_TOKEN"
validate_api_key "HUGGINGFACE_TOKEN" "hf_" 20

echo ""
echo "Checking OAuth configuration..."

# OAuth (optional)
if [ -n "$GOOGLE_CLIENT_ID" ] || [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    check_required "GOOGLE_CLIENT_ID"
    check_required "GOOGLE_CLIENT_SECRET"
fi

if [ -n "$GITHUB_CLIENT_ID" ] || [ -n "$GITHUB_CLIENT_SECRET" ]; then
    check_required "GITHUB_CLIENT_ID"
    check_required "GITHUB_CLIENT_SECRET"
fi

# NextAuth URL validation
if [ -n "$NEXTAUTH_URL" ]; then
    validate_url "NEXTAUTH_URL"
    echo -e "${GREEN}✅ NEXTAUTH_URL is set${NC}"
else
    echo -e "${YELLOW}⚠️  NEXTAUTH_URL not set (will use default in development)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "==================================="

# Summary
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All environment variables are properly configured!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration is valid but has $WARNINGS warning(s)${NC}"
    echo -e "${YELLOW}💡 Consider setting optional variables for full functionality${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo -e "${RED}Please fix the errors before proceeding${NC}"
    echo ""
    echo -e "${YELLOW}💡 Quick setup guide:${NC}"
    echo "1. Copy .env.example to .env: cp .env.example .env"
    echo "2. Generate a secure secret: openssl rand -base64 32"
    echo "3. Add your API keys to .env"
    echo "4. Run this script again to validate"
    exit 1
fi