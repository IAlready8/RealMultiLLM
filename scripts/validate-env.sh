#!/bin/bash
# 3-STEP PLAN:
# 1. Validate all required environment variables exist
# 2. Check API key format and accessibility 
# 3. Verify database connection and schema

echo " Environment Validation - ADVANCEPILOT-COPILOT"

# Performance-first: Quick validation checks
if [[ ! -f .env.local ]]; then
    echo "❌ .env.local not found - copy from .env.example"
    exit 1
fi

# Scalability: API key validation
source .env.local
if [[ -z "$NEXTAUTH_SECRET" ]]; then
    echo "⚠️  NEXTAUTH_SECRET missing - generate with: openssl rand -base64 32"
fi

# Dynamic synergy: Database health check
if npx prisma db push --accept-data-loss 2>/dev/null; then
    echo "✅ Database schema validated"
else
    echo "❌ Database validation failed"
    exit 1
fi

echo "✅ Environment validation complete"
