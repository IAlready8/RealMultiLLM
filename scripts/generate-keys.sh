#!/bin/bash
# Key Generation Helper Script
# Generates all required secrets for RealMultiLLM deployment

echo "🔐 RealMultiLLM - Key Generation Helper"
echo "========================================"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is not installed"
    echo "   Please install openssl and try again"
    exit 1
fi

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "⚠️  Warning: Node.js is not installed"
    echo "   Some key generation methods won't be available"
fi

echo "Generating secure keys for production deployment..."
echo ""

# Generate NEXTAUTH_SECRET
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  NEXTAUTH_SECRET (32+ characters)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo ""

# Generate ENCRYPTION_MASTER_KEY
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  ENCRYPTION_MASTER_KEY (64 hex characters)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ENCRYPTION_MASTER_KEY=$(openssl rand -hex 64)
echo "ENCRYPTION_MASTER_KEY=$ENCRYPTION_MASTER_KEY"
echo ""

# Generate a sample password hash
if command -v node &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "3️⃣  Sample Password Hash (for creating users)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if bcryptjs is available
    if node -e "require('bcryptjs')" 2>/dev/null; then
        SAMPLE_PASSWORD="ChangeMe123!"
        PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync('$SAMPLE_PASSWORD', 10))")
        echo "Sample password: $SAMPLE_PASSWORD"
        echo "Bcrypt hash: $PASSWORD_HASH"
        echo ""
        echo "To hash your own password:"
        echo "  node -e \"console.log(require('bcryptjs').hashSync('YourPassword123!', 10))\""
    else
        echo "⚠️  bcryptjs not installed. Install with: npm install"
        echo "   Or use online bcrypt generator: https://bcrypt-generator.com/"
    fi
    echo ""
fi

# Generate UUID example
if command -v node &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "4️⃣  Sample UUID (for user IDs)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    UUID=$(node -e "console.log(require('crypto').randomUUID())")
    echo "UUID: $UUID"
    echo ""
fi

# Save to file option
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Save to File"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Save these keys to .env.secrets? (y/N): " save_to_file

if [[ $save_to_file == "y" || $save_to_file == "Y" ]]; then
    OUTPUT_FILE=".env.secrets"
    
    # Check if file already exists
    if [ -f "$OUTPUT_FILE" ]; then
        echo "⚠️  Warning: $OUTPUT_FILE already exists!"
        read -p "Overwrite? (y/N): " overwrite
        if [[ $overwrite != "y" && $overwrite != "Y" ]]; then
            echo "Cancelled. Keys not saved."
            exit 0
        fi
    fi
    
    # Write to file
    cat > "$OUTPUT_FILE" << EOF
# Generated Secrets for RealMultiLLM
# Generated on: $(date)
# 
# ⚠️  IMPORTANT: Keep this file secure and NEVER commit to git!
# Add to .gitignore if not already present

# NextAuth Secret (32+ characters)
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Encryption Master Key (64 hex characters)
ENCRYPTION_MASTER_KEY=$ENCRYPTION_MASTER_KEY

# Copy these to Vercel Dashboard → Settings → Environment Variables
# OR copy to .env.local for local development

# For complete environment setup, see:
# - .env.production.example (production variables)
# - .env.example (all available variables)
# - VERCEL_DEPLOYMENT.md (deployment guide)
EOF

    echo "✅ Keys saved to $OUTPUT_FILE"
    echo ""
    echo "⚠️  SECURITY REMINDER:"
    echo "   1. Keep $OUTPUT_FILE secure"
    echo "   2. Do NOT commit to git"
    echo "   3. Add $OUTPUT_FILE to .gitignore if not present"
    echo "   4. Delete after copying to Vercel/environment"
    
    # Check if in .gitignore
    if [ -f .gitignore ]; then
        if ! grep -q ".env.secrets" .gitignore; then
            echo ""
            read -p "Add .env.secrets to .gitignore? (Y/n): " add_gitignore
            if [[ $add_gitignore != "n" && $add_gitignore != "N" ]]; then
                echo ".env.secrets" >> .gitignore
                echo "✅ Added .env.secrets to .gitignore"
            fi
        fi
    fi
else
    echo "Keys not saved. Copy them from above."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Copy NEXTAUTH_SECRET to Vercel:"
echo "   → https://vercel.com/[username]/[project]/settings/environment-variables"
echo ""
echo "2. Copy ENCRYPTION_MASTER_KEY to Vercel (same location)"
echo ""
echo "3. Add other required variables:"
echo "   - DATABASE_URL (from Supabase or Neon)"
echo "   - NEXTAUTH_URL (your Vercel deployment URL)"
echo "   - LLM API keys (OpenAI, Anthropic, Google AI)"
echo ""
echo "4. See complete guide:"
echo "   - VERCEL_DEPLOYMENT.md"
echo "   - .env.production.example"
echo "   - DEPLOYMENT_CHECKLIST.md"
echo ""
echo "✅ Key generation complete!"
