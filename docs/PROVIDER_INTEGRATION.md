# Provider Integration Guide

## Overview

This guide provides comprehensive documentation for integrating new LLM providers into RealMultiLLM, including adding providers, testing API keys, and setting up working APIs with secure key management.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Adding a New Provider](#adding-a-new-provider)
3. [API Key Management](#api-key-management)
4. [Testing API Keys](#testing-api-keys)
5. [Provider Service Implementation](#provider-service-implementation)
6. [API Endpoints](#api-endpoints)
7. [Security Best Practices](#security-best-practices)
8. [Testing and Validation](#testing-and-validation)

---

## Architecture Overview

### Component Layers

```
┌─────────────────────────────────────────────────┐
│  Frontend (Client)                              │
│  - API Key Input Forms                          │
│  - Provider Selection UI                        │
│  - Client-side Validation                       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  API Routes (Next.js)                           │
│  - /api/provider-configs                        │
│  - /api/test-api-key                            │
│  - /api/llm/stream                              │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Services Layer                                 │
│  - Provider Services (openai-service.ts, etc.)  │
│  - API Key Service (encryption/decryption)      │
│  - Config Manager                               │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Database (Prisma)                              │
│  - ProviderConfig (encrypted API keys)          │
│  - User                                         │
│  - Analytics                                    │
└─────────────────────────────────────────────────┘
```

### Key Components

- **lib/providers.ts** - Provider metadata and configuration registry
- **lib/api-key-service.ts** - Server-side API key encryption/decryption
- **lib/secure-storage.ts** - Client-side secure storage helpers
- **services/llm-providers/** - Provider-specific service implementations
- **app/api/provider-configs/** - Provider configuration API routes
- **app/api/test-api-key/** - API key validation endpoint

---

## Adding a New Provider

### Step 1: Add Provider Metadata

Add your provider configuration to `lib/providers.ts`:

```typescript
export const PROVIDERS: Record<string, ProviderConfig> = {
  // ... existing providers

  'your-provider': {
    id: 'your-provider',
    name: 'Your Provider Name',
    description: 'Brief description of the provider',
    website: 'https://your-provider.com',
    defaultModel: 'default-model-id',
    apiKeyEnv: 'YOUR_PROVIDER_API_KEY',
    requiresAuth: true,
    pricing: 'paid', // 'free' | 'paid' | 'freemium'
    color: '#YOUR_BRAND_COLOR',
    models: [
      {
        id: 'model-id',
        name: 'Model Display Name',
        description: 'Model description',
        contextWindow: 8192,
        costPer1KTokens: { input: 0.001, output: 0.002 },
        capabilities: ['text', 'code', 'reasoning']
      }
    ],
    features: [
      'Chat completions',
      'System prompts',
      'Streaming support',
      'Custom feature'
    ]
  }
};
```

### Step 2: Create Provider Service

Create `services/llm-providers/your-provider-service.ts`:

```typescript
import { configManager } from '@/lib/config-manager';
import {
  errorManager,
  LLMProviderError,
  NetworkError,
  ValidationError,
  createErrorContext
} from '@/lib/error-system';
import type { ProviderConfig } from '@/lib/config-schemas';

interface YourProviderRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  userId?: string;
}

interface YourProviderResponse {
  content: string;
  finish_reason: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class YourProviderService {
  private static instance: YourProviderService;
  private baseUrl = 'https://api.your-provider.com/v1';

  private constructor() {}

  public static getInstance(): YourProviderService {
    if (!YourProviderService.instance) {
      YourProviderService.instance = new YourProviderService();
    }
    return YourProviderService.instance;
  }

  async getConfig(userId: string): Promise<ProviderConfig> {
    try {
      const config = await configManager.getProviderConfig(userId, 'your-provider');
      if (!config) {
        const context = createErrorContext('/services/your-provider', userId);
        throw new ValidationError(
          'Your Provider configuration not found',
          'provider_config',
          context
        );
      }
      return config;
    } catch (error) {
      const context = createErrorContext('/services/your-provider', userId, {
        action: 'get_config'
      });
      await errorManager.logError(error as Error, context);
      throw error;
    }
  }

  async testConnection(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const url = baseUrl || this.baseUrl;

      // Test with provider's validation endpoint
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'RealMultiLLM/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const context = createErrorContext('/services/your-provider/test', undefined, {
          status: response.status,
          statusText: response.statusText
        });

        throw new LLMProviderError(
          'your-provider',
          errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          context
        );
      }

      return true;
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      const context = createErrorContext('/services/your-provider/test');
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(
          'Failed to connect to Your Provider API',
          context,
          error
        );
      }

      throw new LLMProviderError('your-provider', (error as Error).message, context);
    }
  }

  async chat(request: YourProviderRequest): Promise<YourProviderResponse> {
    const context = createErrorContext('/services/your-provider/chat', request.userId, {
      model: request.model,
      messages_count: request.messages.length,
    });

    try {
      const config = request.userId ? await this.getConfig(request.userId) : null;
      const apiKey = config?.apiKey;
      const baseUrl = config?.baseUrl || this.baseUrl;
      const model = request.model || 'default-model';

      if (!apiKey) {
        throw new ValidationError(
          'Your Provider API key not configured',
          'api_key',
          context
        );
      }

      // Validate request
      if (!request.messages || request.messages.length === 0) {
        throw new ValidationError(
          'Messages array is required and cannot be empty',
          'messages',
          context
        );
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'RealMultiLLM/1.0',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 4096,
          stream: request.stream ?? false,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`;

        // Handle specific error types
        if (response.status === 401) {
          throw new ValidationError('Invalid API key', 'api_key', context);
        } else if (response.status === 429) {
          throw new LLMProviderError('your-provider', 'Rate limit exceeded', context);
        } else if (response.status >= 500) {
          throw new LLMProviderError('your-provider', 'Service unavailable', context);
        } else {
          throw new LLMProviderError('your-provider', errorMessage, context);
        }
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new LLMProviderError('your-provider', 'No response choices returned', context);
      }

      return {
        content: data.choices[0].message?.content || '',
        finish_reason: data.choices[0].finish_reason,
        usage: data.usage,
      };

    } catch (error) {
      await errorManager.logError(error as Error, context);
      throw error;
    }
  }

  async *streamChat(
    request: YourProviderRequest
  ): AsyncGenerator<string, void, undefined> {
    const context = createErrorContext('/services/your-provider/stream', request.userId, {
      model: request.model,
      messages_count: request.messages.length,
    });

    try {
      const config = request.userId ? await this.getConfig(request.userId) : null;
      const apiKey = config?.apiKey;
      const baseUrl = config?.baseUrl || this.baseUrl;
      const model = request.model || 'default-model';

      if (!apiKey) {
        throw new ValidationError(
          'Your Provider API key not configured',
          'api_key',
          context
        );
      }

      if (!request.messages || request.messages.length === 0) {
        throw new ValidationError(
          'Messages array is required and cannot be empty',
          'messages',
          context
        );
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'RealMultiLLM/1.0',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 4096,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new LLMProviderError('your-provider', errorMessage, context);
      }

      if (!response.body) {
        throw new LLMProviderError('your-provider', 'No response body received', context);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;

                if (content) {
                  yield content;
                }

                if (parsed.choices[0]?.finish_reason) {
                  return;
                }
              } catch (parseError) {
                // Skip malformed chunks
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      await errorManager.logError(error as Error, context);
      throw error;
    }
  }

  async getModels(userId?: string): Promise<string[]> {
    const context = createErrorContext('/services/your-provider/models', userId);

    try {
      if (userId) {
        const config = await this.getConfig(userId);
        return config.models;
      }

      // Return default models
      return configManager.getDefaultModels('your-provider');
    } catch (error) {
      await errorManager.logError(error as Error, context);
      throw error;
    }
  }
}
```

### Step 3: Add Test Handler

Update `app/api/test-api-key/route.ts`:

```typescript
async function testYourProvider(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.your-provider.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Your Provider API key");
  }

  return true;
}

// Add to switch statement in POST handler:
case "your-provider":
  isValid = await testYourProvider(apiKey);
  break;
```

### Step 4: Update Provider Constants

Add to `app/api/provider-configs/route.ts`:

```typescript
const validProviders = [
  'openai',
  'anthropic',
  'claude',
  'google',
  'google-ai',
  'openrouter',
  'github',
  'llama',
  'grok',
  'your-provider', // Add here
] as const;
```

---

## API Key Management

### Server-Side Encryption

API keys are encrypted server-side using AES-GCM encryption:

```typescript
// lib/api-key-service.ts

import { deriveKey, aesGcmEncrypt, aesGcmDecrypt } from './crypto';

// Encryption key derived from environment variable
const getEncryptionKey = async (): Promise<Uint8Array> => {
  const seed = process.env.API_KEY_ENCRYPTION_SEED ||
    'default-encryption-seed-change-in-production';
  return await deriveKey(seed);
}

// Store encrypted API key
export async function storeUserApiKey(
  userId: string,
  provider: string,
  apiKey: string,
  settings?: Record<string, any>
): Promise<ProviderConfig> {
  const encryptionKey = await getEncryptionKey();
  const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey);

  const config = await prisma.providerConfig.upsert({
    where: {
      userId_provider: { userId, provider },
    },
    update: {
      apiKey: encryptedApiKey,
      settings: settings ? (settings as any) : null,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider,
      apiKey: encryptedApiKey,
      settings: settings ? (settings as any) : null,
      isActive: true,
    },
  });

  return config;
}

// Retrieve and decrypt API key
export async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: { userId, provider },
    },
  });

  if (!config || !config.apiKey || !config.isActive) {
    return null;
  }

  try {
    const encryptionKey = await getEncryptionKey();
    return await aesGcmDecrypt(encryptionKey, config.apiKey);
  } catch (error) {
    console.error(`Failed to decrypt API key for ${provider}:`, error);
    return null;
  }
}
```

### Environment Configuration

Set encryption seed in `.env.local`:

```bash
# API key encryption (required for production)
API_KEY_ENCRYPTION_SEED="your-strong-random-seed-at-least-32-chars"
```

Generate a strong seed:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Testing API Keys

### API Endpoint: POST /api/test-api-key

Test an API key before storing:

**Request:**

```json
{
  "provider": "openai",
  "apiKey": "sk-..."
}
```

**Response (Success):**

```json
{
  "valid": true,
  "message": "API key is valid"
}
```

**Response (Error):**

```json
{
  "valid": false,
  "message": "Invalid API key"
}
```

### Frontend Integration

```typescript
// Example: Testing API key before saving

async function testApiKey(provider: string, apiKey: string): Promise<boolean> {
  const response = await fetch('/api/test-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });

  const data = await response.json();
  return data.valid;
}

// Usage in component
const handleSaveApiKey = async () => {
  const isValid = await testApiKey(selectedProvider, apiKey);

  if (!isValid) {
    toast.error('Invalid API key');
    return;
  }

  // Proceed to save
  await saveProviderConfig(selectedProvider, apiKey, settings);
  toast.success('API key saved successfully');
};
```

### Provider-Specific Testing

Each provider has specific validation logic:

#### OpenAI
```typescript
async function testOpenAI(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid OpenAI API key");
  }

  return true;
}
```

#### Anthropic (Claude)
```typescript
async function testClaude(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Claude API key");
  }

  return true;
}
```

#### Google AI (Gemini)
```typescript
async function testGoogleAI(apiKey: string): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Invalid Google AI API key");
  }

  return true;
}
```

---

## Provider Service Implementation

### Standard Interface

All provider services should implement:

```typescript
interface ILLMProviderService {
  // Singleton instance
  getInstance(): ILLMProviderService;

  // Get user configuration
  getConfig(userId: string): Promise<ProviderConfig>;

  // Test API key connectivity
  testConnection(apiKey: string, baseUrl?: string): Promise<boolean>;

  // Single-shot completion
  chat(request: ChatRequest): Promise<ChatResponse>;

  // Streaming completion
  streamChat(request: ChatRequest): AsyncGenerator<string, void, undefined>;

  // Get available models
  getModels(userId?: string): Promise<string[]>;
}
```

### Error Handling

Use the centralized error system:

```typescript
import {
  errorManager,
  LLMProviderError,
  NetworkError,
  ValidationError,
  createErrorContext
} from '@/lib/error-system';

// Example error handling
try {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new LLMProviderError(
      'provider-id',
      `HTTP ${response.status}`,
      createErrorContext('/service/provider', userId)
    );
  }
} catch (error) {
  if (error instanceof TypeError) {
    throw new NetworkError(
      'Network connection failed',
      createErrorContext('/service/provider', userId),
      error
    );
  }
  throw error;
}
```

### Streaming Implementation

Standard streaming pattern:

```typescript
async *streamChat(request: ChatRequest): AsyncGenerator<string, void, undefined> {
  const response = await fetch(url, {
    ...options,
    body: JSON.stringify({ ...params, stream: true }),
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;

            if (content) yield content;

            if (parsed.choices[0]?.finish_reason) return;
          } catch {
            continue; // Skip malformed chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

---

## API Endpoints

### 1. GET /api/provider-configs

Get all provider configurations for the authenticated user.

**Headers:**
```
Cookie: next-auth.session-token=...
```

**Response:**
```json
{
  "configs": [
    {
      "id": "clxxx...",
      "provider": "openai",
      "isActive": true,
      "settings": {
        "defaultModel": "gpt-4o",
        "temperature": 0.7
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. POST /api/provider-configs

Store or update a provider configuration.

**Request:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "settings": {
    "defaultModel": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

**Response:**
```json
{
  "config": {
    "id": "clxxx...",
    "provider": "openai",
    "isActive": true,
    "settings": {...},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. PUT /api/provider-configs

Update provider settings only (without changing API key).

**Request:**
```json
{
  "provider": "openai",
  "settings": {
    "defaultModel": "gpt-4o-mini",
    "temperature": 0.5
  }
}
```

**Response:**
```json
{
  "config": {
    "id": "clxxx...",
    "provider": "openai",
    "isActive": true,
    "settings": {...},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. POST /api/test-api-key

Test an API key before storing.

**Request:**
```json
{
  "provider": "openai",
  "apiKey": "sk-..."
}
```

**Response (Success):**
```json
{
  "valid": true,
  "message": "API key is valid"
}
```

**Response (Failure):**
```json
{
  "valid": false,
  "message": "Invalid API key: Incorrect API key provided"
}
```

### 5. POST /api/llm/stream

Stream chat completions.

**Request:**
```json
{
  "provider": "openai",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "options": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

**Response (NDJSON stream):**
```
{"type":"chunk","content":"Hello"}
{"type":"chunk","content":"!"}
{"type":"chunk","content":" How"}
{"type":"chunk","content":" can"}
{"type":"chunk","content":" I"}
{"type":"chunk","content":" help"}
{"type":"chunk","content":" you"}
{"type":"chunk","content":"?"}
{"type":"done"}
```

---

## Security Best Practices

### 1. Environment Variables

Never commit API keys to version control:

```bash
# .env.local (not committed)
API_KEY_ENCRYPTION_SEED="your-strong-random-seed"
OPENAI_API_KEY="sk-..." # Optional: for server-side fallback
```

### 2. Server-Side Encryption

Always encrypt API keys before storing:

```typescript
// ✅ Good
const encryptedKey = await aesGcmEncrypt(encryptionKey, apiKey);
await prisma.providerConfig.create({
  data: { apiKey: encryptedKey, ... }
});

// ❌ Bad
await prisma.providerConfig.create({
  data: { apiKey: apiKey, ... } // Plain text!
});
```

### 3. Client-Side Validation

Validate input before sending to server:

```typescript
// Validate API key format
const validateApiKey = (provider: string, apiKey: string): boolean => {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-]+$/,
    'google-ai': /^[a-zA-Z0-9_-]{39}$/,
  };

  const pattern = patterns[provider];
  return pattern ? pattern.test(apiKey) : true;
};
```

### 4. Rate Limiting

Implement rate limiting on sensitive endpoints:

```typescript
import { checkAndConsume } from '@/lib/rate-limit';

const perUserMax = 60; // 60 requests per minute
const windowMs = 60000; // 1 minute

const result = await checkAndConsume(
  `test-api-key:${session.user.id}`,
  { windowMs, max: perUserMax }
);

if (!result.allowed) {
  return tooManyRequests('Rate limit exceeded', {
    retryAfterMs: result.retryAfterMs,
    remaining: result.remaining,
  });
}
```

### 5. Authentication

Always require authentication for API key operations:

```typescript
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  // Proceed with authenticated request
}
```

### 6. Audit Logging

Log all API key operations:

```typescript
import logger from '@/lib/logger';

logger.info('Provider config stored', {
  userId: session.user.id,
  provider: provider,
  timestamp: new Date().toISOString(),
});
```

---

## Testing and Validation

### Unit Tests

Create tests for provider services:

```typescript
// test/services/your-provider-service.test.ts

import { describe, it, expect, vi } from 'vitest';
import { YourProviderService } from '@/services/llm-providers/your-provider-service';

describe('YourProviderService', () => {
  it('should test connection with valid API key', async () => {
    const service = YourProviderService.getInstance();

    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ models: [] }),
      })
    );

    const result = await service.testConnection('valid-api-key');
    expect(result).toBe(true);
  });

  it('should throw error with invalid API key', async () => {
    const service = YourProviderService.getInstance();

    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } }),
      })
    );

    await expect(
      service.testConnection('invalid-api-key')
    ).rejects.toThrow('Invalid API key');
  });

  it('should stream chat messages', async () => {
    const service = YourProviderService.getInstance();

    // Mock streaming response
    const chunks = ['Hello', ' ', 'World', '!'];
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({
              choices: [{ delta: { content: chunk } }]
            })}\n`)
          );
        });
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
        controller.close();
      }
    });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: stream,
      })
    );

    const generator = service.streamChat({
      messages: [{ role: 'user', content: 'Test' }],
      userId: 'test-user',
    });

    const result: string[] = [];
    for await (const chunk of generator) {
      result.push(chunk);
    }

    expect(result).toEqual(chunks);
  });
});
```

### Integration Tests

Test API endpoints:

```typescript
// test/api/provider-configs.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/provider-configs/route';

describe('POST /api/provider-configs', () => {
  beforeEach(async () => {
    // Setup test database
  });

  it('should store provider configuration', async () => {
    const request = new Request('http://localhost/api/provider-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-test-key',
        settings: { defaultModel: 'gpt-4o' },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.config).toBeDefined();
    expect(data.config.provider).toBe('openai');
  });
});
```

### End-to-End Tests

Test complete user flows with Playwright:

```typescript
// test/e2e/provider-setup.spec.ts

import { test, expect } from '@playwright/test';

test('user can add and test API key', async ({ page }) => {
  await page.goto('/settings');

  // Select provider
  await page.selectOption('[data-testid="provider-select"]', 'openai');

  // Enter API key
  await page.fill('[data-testid="api-key-input"]', 'sk-test-key');

  // Test API key
  await page.click('[data-testid="test-api-key-button"]');

  // Wait for validation
  await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();

  // Save configuration
  await page.click('[data-testid="save-config-button"]');

  // Verify success message
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
});
```

---

## Complete Integration Checklist

When adding a new provider, verify:

- [ ] Provider metadata added to `lib/providers.ts`
- [ ] Provider service created in `services/llm-providers/`
- [ ] Test handler added to `app/api/test-api-key/route.ts`
- [ ] Provider added to `validProviders` in `app/api/provider-configs/route.ts`
- [ ] Provider documentation added to `docs/API_PROVIDERS.md`
- [ ] Unit tests written for provider service
- [ ] Integration tests written for API endpoints
- [ ] E2E tests written for user flows
- [ ] Error handling implemented
- [ ] Streaming support implemented (if applicable)
- [ ] Security review completed
- [ ] Performance testing completed
- [ ] Documentation reviewed and updated

---

## Troubleshooting

### Common Issues

#### 1. API Key Decryption Failure

**Symptom:** `Failed to decrypt API key` errors

**Solution:**
- Verify `API_KEY_ENCRYPTION_SEED` is set correctly
- Check that the seed hasn't changed since keys were encrypted
- Ensure Prisma client is generated: `npx prisma generate`

#### 2. Test Connection Timeout

**Symptom:** API key tests timing out

**Solution:**
- Increase timeout: `signal: AbortSignal.timeout(30000)`
- Check network connectivity
- Verify provider API endpoint is correct
- Check for rate limiting

#### 3. Streaming Connection Errors

**Symptom:** Stream disconnects or errors

**Solution:**
- Implement proper error handling in stream reader
- Add connection cleanup in `finally` block
- Use stream connection manager for tracking
- Handle abort signals properly

#### 4. Rate Limiting

**Symptom:** 429 errors from provider APIs

**Solution:**
- Implement exponential backoff
- Cache provider metadata
- Reduce concurrent requests
- Use queue system for requests

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Vitest Testing Library](https://vitest.dev)
- [Playwright E2E Testing](https://playwright.dev)

---

## Support

For issues or questions:

1. Check existing documentation
2. Review error logs in observability dashboard
3. Run diagnostic tests: `npm test`
4. Check provider status pages
5. Review GitHub issues: [RealMultiLLM Issues](https://github.com/your-repo/issues)
