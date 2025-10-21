# RealMultiLLM Encryption Guide

## Overview

This project uses enterprise-grade AES-256-GCM encryption for all sensitive data, particularly API keys. The encryption system provides:

- **Authenticated Encryption**: AES-256-GCM with integrity verification
- **Key Derivation**: HKDF (HMAC-based Key Derivation Function) for proper key stretching
- **Provider Binding**: API keys are bound to specific providers to prevent cross-provider attacks
- **Forward Secrecy**: Each encryption operation uses a unique IV/nonce
- **Migration Support**: Safe migration from legacy encryption formats

## Quick Start

### 1. Setup Encryption
```bash
./scripts/encryption-setup.sh
```

### 2. Verify Setup
```bash
npm run test -- test/security/advanced-encryption.test.ts
```

### 3. Migrate Existing Keys (if needed)
```bash
curl -X POST http://localhost:3000/api/encryption/migrate \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

## Environment Variables

### Required
- `ENCRYPTION_MASTER_KEY`: 128-character hex string (512 bits of entropy)
- `NEXTAUTH_SECRET`: Used for NextAuth.js session encryption

### Optional
- `ADMIN_EMAILS`: Comma-separated list of admin emails for migration API access

## API Usage

### Store Encrypted API Key
```typescript
import { getEncryptionIntegration } from '@/lib/encryption-integration';
import { prisma } from '@/lib/prisma';

const integration = getEncryptionIntegration(prisma);
await integration.storeApiKey(userId, 'openai', 'sk-your-api-key');
```

### Retrieve Decrypted API Key
```typescript
const apiKey = await integration.getApiKey(userId, 'openai');
```

### Direct Encryption/Decryption
```typescript
import { encryptApiKey, decryptApiKey } from '@/lib/crypto-enterprise';

const encrypted = await encryptApiKey('sk-your-key', 'openai');
const decrypted = await decryptApiKey(encrypted, 'openai');
```

## Security Features

### Provider Binding
API keys are cryptographically bound to their provider:
```typescript
const openaiEncrypted = await encryptApiKey('sk-key', 'openai');
// This will fail - provider mismatch
await decryptApiKey(openaiEncrypted, 'anthropic'); // ❌ Throws error
```

### Key Validation
```typescript
import { validateMasterKey } from '@/lib/crypto-enterprise';

const validation = validateMasterKey(key);
if (!validation.valid) {
  console.error(validation.reason);
}
```

### Secure Key Generation
```typescript
import { generateMasterKey } from '@/lib/crypto-enterprise';

const newKey = generateMasterKey(); // 128 hex characters (512 bits)
```

## Migration

### Check Migration Status
```bash
curl -X GET http://localhost:3000/api/encryption/migrate \
  -H "Authorization: Bearer <admin-token>"
```

### Dry Run Migration
```bash
curl -X POST http://localhost:3000/api/encryption/migrate \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### Actual Migration
```bash
curl -X POST http://localhost:3000/api/encryption/migrate \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### Selective Migration
```bash
curl -X POST http://localhost:3000/api/encryption/migrate \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "providers": ["openai", "anthropic"]}'
```

## Testing

### Run All Encryption Tests
```bash
npm run test test/security/advanced-encryption.test.ts
npm run test test/integration/encryption-workflow.test.ts
```

### Test Coverage
```bash
npm run test:coverage -- --include="**/crypto-enterprise.ts" --include="**/encryption-integration.ts"
```

## Troubleshooting

### Common Issues

1. **"Master key must be at least 64 characters long"**
   - Generate a new key: `./scripts/encryption-setup.sh`
   - Verify ENCRYPTION_MASTER_KEY in .env.local

2. **"Cannot use default key in production"**
   - Replace the default key with a secure one
   - Run encryption setup script

3. **"Provider mismatch" errors**
   - API keys are bound to providers
   - Re-encrypt with correct provider name

4. **Migration failures**
   - Check database connection
   - Verify admin permissions
   - Review error details in response

### Debug Mode
Set environment variable for detailed logging:
```bash
DEBUG=encryption:* npm run dev
```

## Security Best Practices

1. **Key Management**
   - Store ENCRYPTION_MASTER_KEY securely (e.g., AWS Secrets Manager)
   - Never commit keys to version control
   - Rotate keys periodically

2. **Access Control**
   - Limit migration API to admin users only
   - Use HTTPS in production
   - Implement rate limiting

3. **Monitoring**
   - Monitor encryption/decryption errors
   - Alert on validation failures
   - Track key usage patterns

4. **Backup Strategy**
   - Backup encrypted data and keys separately
   - Test recovery procedures
   - Document key rotation process

## Architecture

### Encryption Flow
```
Plaintext API Key
    ↓
HKDF Key Derivation (with salt)
    ↓
AES-256-GCM Encryption (with IV + AAD)
    ↓
Base64 Encoding
    ↓
Versioned Format: v3:AES-256-GCM:base64data
```

### Database Schema
```sql
CREATE TABLE ProviderConfig (
  id            String    @id @default(cuid())
  userId        String
  provider      String
  encryptedApiKey String? -- Encrypted with AES-256-GCM
  keyPrefix     String?   -- First 8 chars for display
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastUsed      DateTime?
);
```

## Migration from Legacy Systems

### Identifying Legacy Keys
Legacy keys can be identified by their format:
- **v3 (current)**: `v3:AES-256-GCM:base64data`
- **v2 (legacy)**: `v2:gcm:base64data` 
- **v1 (legacy)**: Plain base64 or XOR-encrypted
- **Plaintext**: Raw API key strings

### Migration Process
1. **Assessment**: Use GET `/api/encryption/migrate` to assess current state
2. **Dry Run**: Run migration with `dryRun: true` to preview changes
3. **Backup**: Backup database before actual migration
4. **Migration**: Run actual migration with proper admin authentication
5. **Validation**: Verify all keys decrypt correctly post-migration

### Rollback Strategy
- Keep database backups before migration
- Legacy decryption functions remain available for emergency access
- Migration logs provide detailed tracking of all changes

For more details, see the source code in:
- `/lib/crypto-enterprise.ts` - Core encryption functions
- `/lib/encryption-integration.ts` - Database integration
- `/app/api/encryption/migrate/route.ts` - Migration API