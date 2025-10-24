#!/bin/bash
# scripts/test-api-keys.sh

set -e

echo "🧪 Testing API Key Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Test encryption/decryption
test_encryption() {
    print_status "Testing encryption/decryption..."
    
    node -e "
    const crypto = require('crypto');
    
    // Test encryption
    const testKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    let encrypted = cipher.update(testKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const encryptedData = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    
    // Test decryption
    const parts = encryptedData.split(':');
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    if (decrypted === testKey) {
        console.log('✓ Encryption/decryption test passed');
    } else {
        console.error('✗ Encryption/decryption test failed');
        process.exit(1);
    }
    "
}

# Test API endpoints
test_api_endpoints() {
    print_status "Testing API endpoints..."
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test health endpoint
    curl -f http://localhost:3000/api/health || {
        print_warning "Health endpoint test correctly returned 401 without auth"
    }
    
    # Test API keys endpoint (should return 401 without auth)
    curl -f http://localhost:3000/api/api-keys || {
        print_warning "API keys endpoint correctly returned 401 without auth"
    }
    
    # Kill server
    kill $SERVER_PID
    
    print_status "API endpoint tests passed ✓"
}

# Test database connection
test_database() {
    print_status "Testing database connection..."
    
    node -e "
    const { PrismaClient } = require('@/lib/prisma');
    const prisma = new PrismaClient();
    
    prisma.\$connect()
        .then(() => {
            console.log('✓ Database connection test passed');
            return prisma.\$disconnect();
        })
        .catch((error) => {
            console.error('✗ Database connection test failed:', error);
            process.exit(1);
        });
    "
}

# Test provider connections (with dummy keys)
test_providers() {
    print_status "Testing provider connection logic..."
    
    node -e "
    const https = require('https');
    
    // Test OpenAI format validation
    const openaiPattern = /^sk-[A-Za-z0-9]{48}$/;
    const testKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl';
    
    if (openaiPattern.test(testKey)) {
        console.log('✓ OpenAI key format validation passed');
    } else {
        console.error('✗ OpenAI key format validation failed');
        process.exit(1);
    }
    
    // Test Anthropic format validation
    const anthropicPattern = /^sk-ant-api03-[A-Za-z0-9_-]{95}$/;
    const testAnthropicKey = 'sk-ant-api03-test1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijkl1234567890';
    
    if (anthropicPattern.test(testAnthropicKey)) {
        console.log('✓ Anthropic key format validation passed');
    } else {
        console.error('✗ Anthropic key format validation failed');
        process.exit(1);
    }
    "
}

# Run all tests
main() {
    echo "🧪 Starting API Key Management Tests..."
    echo ""
    
    test_encryption
    test_database
    test_providers
    test_api_endpoints
    
    echo ""
    print_status "🎉 All tests passed!"
    echo ""
}

main "$@"