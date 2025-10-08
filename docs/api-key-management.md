# API Key Management Guide

## Overview

This guide provides detailed instructions for securely managing API keys for different LLM providers in the RealMultiLLM platform. Proper API key management is crucial for security, cost control, and accessing provider features.

## Security Principles

### Encryption
All API keys are encrypted using AES-256 encryption before being stored in the database:

1. **Master Key**: A 64-character hex key (`ENCRYPTION_MASTER_KEY`) is used for encryption/decryption
2. **Per-Key Salting**: Each API key is encrypted with a unique salt
3. **Database Storage**: Encrypted keys are stored in the database with appropriate permissions

### Key Storage Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Encryption     │───▶│ Database Store  │
│   (Plain Key)   │    │  (AES-256)      │    │  (Encrypted)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Environment Variables
API keys can be set as environment variables for development or production use:

```bash
# Critical Security Variables
ENCRYPTION_MASTER_KEY=generate-a-secure-64-character-hex-key-using-openssl-rand-hex-64
NEXTAUTH_SECRET=generate-a-secure-32-character-base64-key-using-openssl-rand-base64-32

# Database Configuration
DATABASE_URL=file:./dev.db

# Optional Provider Keys (can be set via UI)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key
GROK_API_KEY=your-grok-api-key
```

## Key Generation Commands

### Master Encryption Key
```bash
# Generate ENCRYPTION_MASTER_KEY (64-character hex)
openssl rand -hex 64
```

### NextAuth Secret
```bash
# Generate NEXTAUTH_SECRET (32+ character base64)
openssl rand -base64 32
```

### Session Secret
```bash
# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Provider-Specific Key Management

### OpenAI

#### Key Requirements
- Format: `sk-[alphanumeric]{48}`
- Prefix: `sk-`
- Length: 51 characters total

#### Obtaining Keys
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Navigate to "API Keys" section
3. Click "Create new secret key"
4. Copy the generated key immediately (it won't be shown again)

#### Example
```
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab
```

#### Key Validation
```typescript
// Validate OpenAI API key format
function validateOpenAIKey(key: string): boolean {
  return /^sk-[a-zA-Z0-9]{48}$/.test(key);
}
```

### Anthropic

#### Key Requirements
- Format: `sk-ant-[alphanumeric]{32}-[alphanumeric]{32}`
- Prefix: `sk-ant-`
- Length: 74 characters total

#### Obtaining Keys
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Navigate to "API Keys" section
3. Click "Create Key"
4. Copy the generated key immediately

#### Example
```
ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567
```

#### Key Validation
```typescript
// Validate Anthropic API key format
function validateAnthropicKey(key: string): boolean {
  return /^sk-ant-[a-zA-Z0-9]{32}-[a-zA-Z0-9]{32}$/.test(key);
}
```

### Google AI (Gemini)

#### Key Requirements
- Format: `[alphanumeric]{39}`
- Length: 39 characters
- No specific prefix required

#### Obtaining Keys
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Navigate to "API Keys" section
3. Click "Create API Key"
4. Copy the generated key

#### Example
```
GOOGLE_AI_API_KEY=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789a
```

#### Key Validation
```typescript
// Validate Google AI API key format
function validateGoogleAIKey(key: string): boolean {
  return /^[a-zA-Z0-9]{39}$/.test(key);
}
```

### OpenRouter

#### Key Requirements
- Format: `sk-or-[alphanumeric]{24}`
- Prefix: `sk-or-`
- Length: 32 characters total

#### Obtaining Keys
1. Visit [OpenRouter](https://openrouter.ai/)
2. Navigate to "Keys" section
3. Click "Create Key"
4. Copy the generated key

#### Example
```
OPENROUTER_API_KEY=sk-or-abcdefghijklmnopqrstuvwxyzABCDEF
```

#### Key Validation
```typescript
// Validate OpenRouter API key format
function validateOpenRouterKey(key: string): boolean {
  return /^sk-or-[a-zA-Z0-9]{24}$/.test(key);
}
```

### Grok

#### Key Requirements
- Format: Varies depending on xAI access
- Typically begins with `xai-` or similar prefix
- Length: Variable (typically 40-50 characters)

#### Obtaining Keys
1. Visit [xAI Developer Portal](https://developer.x.ai/)
2. Navigate to "API Keys" section
3. Create a new API key
4. Copy the generated key

#### Example
```
GROK_API_KEY=xai-abcdefghijklmnopqrstuvwxyzABCDEFGH
```

#### Key Validation
```typescript
// Validate Grok API key format
function validateGrokKey(key: string): boolean {
  return /^xai-[a-zA-Z0-9_-]{36,}$/.test(key);
}
```

## Key Storage and Retrieval

### Setting Keys
API keys can be set through the UI or programmatically:

```typescript
// Set an API key
await fetch('/api/settings/api-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'openai',
    apiKey: 'sk-your-api-key-here'
  })
});
```

### Retrieving Keys
Stored keys are retrieved and decrypted when needed:

```typescript
// Get stored API keys
const response = await fetch('/api/settings/api-keys');
const keys = await response.json();
```

### Removing Keys
Keys can be removed when no longer needed:

```typescript
// Remove an API key
await fetch(`/api/settings/api-keys/openai`, {
  method: 'DELETE'
});
```

## Key Testing and Validation

### Automated Testing
The platform includes automated API key testing:

1. **Connection Test**: Verify connectivity to provider API
2. **Key Format Validation**: Check for proper key format
3. **Permission Verification**: Validate API key permissions
4. **Rate Limit Testing**: Test rate limits without exceeding them

### Test Implementation
```typescript
interface ApiKeyTest {
  validateKey(provider: string, key: string): Promise<ValidationResult>;
  testConnection(provider: string, key: string): Promise<ConnectionResult>;
  formatCheck(provider: string, key: string): Promise<FormatResult>;
}

class ApiKeyTester implements ApiKeyTest {
  async validateKey(provider: string, key: string): Promise<ValidationResult> {
    // Validate key format and connectivity
    const formatResult = await this.formatCheck(provider, key);
    if (!formatResult.valid) return formatResult;
    
    const connectionResult = await this.testConnection(provider, key);
    return {
      ...formatResult,
      ...connectionResult,
      valid: formatResult.valid && connectionResult.connected
    };
  }
}
```

## Key Lifecycle Management

### Rotation
Regular key rotation is recommended:

1. **Scheduled Rotation**: Rotate keys every 30-90 days
2. **Event-Based Rotation**: Rotate after security incidents
3. **Automated Rotation**: Implement automated rotation where possible

### Monitoring
Monitor key usage and security:

1. **Usage Tracking**: Track API requests and token consumption
2. **Anomaly Detection**: Detect unusual usage patterns
3. **Alerting**: Set up alerts for suspicious activity

### Revocation
Revoke keys when necessary:

1. **Compromised Keys**: Immediately revoke if keys are exposed
2. **Unused Keys**: Revoke keys that haven't been used recently
3. **Deprecated Keys**: Revoke keys for discontinued services

## Security Best Practices

### Key Storage
1. **Encryption**: Always encrypt keys before storing
2. **Environment Isolation**: Use different keys for dev/staging/production
3. **Access Control**: Limit who can view or modify keys
4. **Audit Logging**: Log all key access and modifications

### Key Usage
1. **Least Privilege**: Grant minimum required permissions
2. **Rate Limiting**: Implement client-side rate limiting
3. **Error Handling**: Properly handle API errors without exposing keys
4. **Fallback Strategies**: Implement fallback mechanisms for key failures

### Key Distribution
1. **Never Hardcode**: Avoid hardcoding keys in source code
2. **Configuration Management**: Use secure configuration management
3. **Version Control**: Exclude keys from version control systems
4. **Secret Management**: Use dedicated secret management services

## Troubleshooting

### Common Issues

1. **Invalid Key Format**
   - Symptom: Key validation fails immediately
   - Solution: Check provider-specific key format requirements

2. **Authentication Failure**
   - Symptom: API returns 401/403 errors
   - Solution: Verify key validity and permissions

3. **Rate Limiting**
   - Symptom: API returns 429 errors
   - Solution: Implement proper rate limiting

4. **Network Issues**
   - Symptom: Connection timeouts or failures
   - Solution: Check connectivity and firewall settings

### Debugging Steps

1. **Verify Key Format**
   ```bash
   # Check that your key matches the expected format
   echo $OPENAI_API_KEY | grep -E '^sk-[a-zA-Z0-9]{48}$'
   ```

2. **Test Key Connectivity**
   ```bash
   # Test OpenAI key connectivity
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json"
   ```

3. **Check Key Permissions**
   ```bash
   # Test key permissions with a simple request
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model": "claude-3-haiku-20240307", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}'
   ```

4. **Validate Environment Variables**
   ```bash
   # Check that all required environment variables are set
   printenv | grep "_API_KEY"
   ```

## Recovery Procedures

### Key Compromise
1. Immediately rotate the compromised key
2. Update the application with the new key
3. Audit usage since the compromise
4. Notify affected users if necessary

### Database Key Loss
1. Restore from backup if possible
2. Re-encrypt keys using the master key
3. Validate all restored keys
4. Update application configuration

## Compliance Considerations

### Data Protection
1. All keys are encrypted at rest
2. Secure deletion procedures are implemented
3. Access control logging is maintained
4. Regular security audits are performed

### Regulatory Requirements
1. GDPR compliance for key handling
2. SOC 2 requirements for security
3. PCI DSS standards if applicable
4. Industry-specific compliance measures

## Automation and CI/CD

### Key Rotation Automation
Implement automated key rotation:

```bash
#!/bin/bash
# Rotate API keys script
# This script generates new keys and updates the application

# Generate new keys
NEW_OPENAI_KEY=$(curl -s -X POST https://api.openai.com/v1/api_keys \
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY" \
  -d '{"name": "rotated-key-$(date +%s)"}' | jq -r '.key')

# Update application
vercel env add OPENAI_API_KEY production <<< "$NEW_OPENAI_KEY"

# Revoke old key
curl -s -X DELETE https://api.openai.com/v1/api_keys/$OLD_OPENAI_KEY \
  -H "Authorization: Bearer $OPENAI_ADMIN_KEY"
```

### Security Scanning
Implement security scanning for exposed keys:

```bash
#!/bin/bash
# Scan for exposed API keys
# This script checks the codebase for accidentally committed keys

# Scan for OpenAI keys
grep -r "sk-[a-zA-Z0-9]\{48\}" . --exclude-dir=node_modules --exclude-dir=.git

# Scan for Anthropic keys
grep -r "sk-ant-[a-zA-Z0-9]\{32\}-[a-zA-Z0-9]\{32\}" . --exclude-dir=node_modules --exclude-dir=.git

# Scan for Google AI keys
grep -r "^[a-zA-Z0-9]\{39\}$" . --exclude-dir=node_modules --exclude-dir=.git
```

## Monitoring and Analytics

### Key Usage Metrics
Track key usage for optimization:

```typescript
// Track API key usage
const usageMetrics = {
  provider: 'openai',
  model: 'gpt-4o',
  requests: 1250,
  tokens: {
    input: 250000,
    output: 100000,
    total: 350000
  },
  cost: 12.45,
  errors: 5,
  avgResponseTime: 1250 // in milliseconds
};
```

### Performance Monitoring
Monitor key performance:

```typescript
// Monitor API performance
const performanceMetrics = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  responseTimes: [850, 920, 1100, 1250, 780],
  successRate: 98.5,
  errorTypes: {
    rateLimit: 2,
    auth: 0,
    network: 3,
    api: 0
  }
};
```

## Further Reading

- [Provider Integration Guide](./provider-integration-guide.md)
- [API Documentation](./api-documentation.md)
- [Security Guide](./security-guide.md)
- [Performance Optimization](./performance-optimization.md)