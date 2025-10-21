# Provider Configuration System

This document describes the new provider configuration system that enables secure management of LLM provider API keys.

## Overview

The provider configuration system consists of:
- API routes for secure key storage and testing
- React hooks for state management
- UI components for user interaction
- Backend encryption service for secure storage

## Components

### 1. API Routes

#### `/api/provider-configs` (GET, POST, PUT)
Main endpoint for CRUD operations on provider configurations.
- **GET**: Retrieve all provider configurations for the authenticated user
- **POST**: Create or update a provider configuration with API key
- **PUT**: Update provider settings without changing the API key

#### `/api/provider-configs/test` (POST)
Test an API key in real-time without saving it.
- Validates API keys against actual provider APIs
- Supports: OpenAI, OpenRouter, Claude, Google AI, Grok, GitHub, Llama
- Returns validation status and error messages

#### `/api/provider-configs/[provider]` (GET, POST, PUT, DELETE)
Provider-specific configuration management.
- **GET**: Get configuration for a specific provider
- **POST**: Create configuration with connection testing
- **PUT**: Update configuration with optional connection testing
- **DELETE**: Delete configuration for a specific provider

### 2. React Hooks

#### `useProviderConfig()`
Comprehensive hook for managing provider configurations.

**Returns:**
```typescript
{
  configs: ProviderConfig[],        // Array of all configurations
  loading: boolean,                  // Loading state
  error: string | null,              // Error state
  fetchConfigs: () => Promise<void>, // Refresh configurations
  saveConfig: (input: ProviderConfigInput) => Promise<ProviderConfig | null>,
  updateSettings: (provider: string, settings: Record<string, any>) => Promise<ProviderConfig | null>,
  deleteConfig: (provider: string) => Promise<boolean>,
  testApiKey: (provider: string, apiKey: string) => Promise<TestResult>,
  getConfig: (provider: string) => ProviderConfig | undefined,
  isConfigured: (provider: string) => boolean
}
```

**Usage Example:**
```typescript
import { useProviderConfig } from '@/hooks/use-provider-config';

function MyComponent() {
  const { saveConfig, testApiKey, isConfigured } = useProviderConfig();
  
  const handleSave = async () => {
    const result = await testApiKey('openai', apiKey);
    if (result.valid) {
      await saveConfig({ provider: 'openai', apiKey });
    }
  };
  
  return <div>{isConfigured('openai') ? 'Configured' : 'Not configured'}</div>;
}
```

### 3. UI Components

#### `<ProviderConfig />`
Full-featured provider configuration interface.

**Features:**
- Card-based UI for each provider
- Password field with show/hide toggle
- Save and delete buttons with loading states
- Visual indicators for configured providers
- Delete confirmation dialog
- Integration with toast notifications

**Usage:**
```typescript
import ProviderConfig from '@/components/provider-config';

export default function SettingsPage() {
  return <ProviderConfig />;
}
```

#### `<ApiKeyTester />`
Interactive API key testing interface.

**Features:**
- Provider selection dropdown
- Secure password input with toggle
- Real-time validation feedback
- Success/error alerts with messages
- Clear button to reset form
- Educational information panel

**Usage:**
```typescript
import ApiKeyTester from '@/components/api-key-tester';

export default function TestingPage() {
  return <ApiKeyTester />;
}
```

### 4. Demo Page

Visit `/provider-management` to see both components in action with a tabbed interface.

## Supported Providers

| Provider | ID | Format | Validation Method |
|----------|-----|--------|-------------------|
| OpenAI | `openai` | `sk-...` | GET /v1/models |
| OpenRouter | `openrouter` | `sk-or-v1-...` | GET /api/v1/models |
| Claude (Anthropic) | `claude` | `sk-ant-...` | POST /v1/messages |
| Google AI | `google` | `AIza...` | GET /v1beta/models |
| Grok (X.AI) | `grok` | `xai-...` | GET /v1/models |
| Llama (Ollama) | `llama` | any | Format validation |
| GitHub Copilot | `github` | `gho_...` or `github_...` | Format validation |

## Security Features

### Encryption
All API keys are encrypted using AES-256-GCM before storage in the database.
- Server-side encryption key from environment variable
- Keys never exposed in responses
- Automatic encryption/decryption via `api-key-service`

### Authentication
All API routes require valid NextAuth session.
- 401 Unauthorized for missing/invalid sessions
- User can only access their own configurations
- Database queries scoped to user ID

### Validation
- Zod schemas for input validation
- Provider enum validation
- Real-time API key testing before storage
- Sanitized error messages (no key exposure)

## Integration with Existing Code

### Database Schema
Uses existing `ProviderConfig` model from Prisma schema:
```prisma
model ProviderConfig {
  id         String    @id @default(cuid())
  provider   String
  apiKey     String?   // Encrypted
  settings   String?   // JSON
  isActive   Boolean   @default(true)
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  
  @@unique([userId, provider])
}
```

### Services Used
- `/lib/api-key-service.ts` - Encrypted storage/retrieval
- `/lib/auth.ts` - NextAuth configuration
- `/lib/http.ts` - Standardized HTTP responses
- `/lib/logger.ts` - Structured logging

### UI Components Used
- shadcn/ui components (Button, Input, Card, etc.)
- Lucide React icons
- Toast notifications for feedback

## Environment Variables

Required for encryption:
```env
API_KEY_ENCRYPTION_SEED="your-encryption-seed-change-in-production"
```

## Error Handling

All API routes return standardized error responses:
```typescript
{
  error: string,           // Error message
  details?: any            // Optional validation details
}
```

Status codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation errors)
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

## Best Practices

1. **Always test API keys** before saving them
2. **Use strong encryption seeds** in production
3. **Rotate API keys** regularly
4. **Monitor API usage** to detect unauthorized access
5. **Delete unused configurations** to minimize security surface

## Future Enhancements

Potential improvements:
- Key rotation automation
- Usage analytics per provider
- Cost tracking integration
- Multi-region key management
- Backup/recovery mechanisms
- Bulk import/export functionality
