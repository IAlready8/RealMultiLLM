# Provider API Documentation

**Complete reference for LLM provider integration, configuration, and usage.**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Provider Integration](#provider-integration)
4. [API Endpoints](#api-endpoints)
5. [Authentication & Security](#authentication--security)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Testing & Validation](#testing--validation)
9. [Performance & Optimization](#performance--optimization)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The RealMultiLLM platform provides a unified interface for integrating and managing multiple LLM providers. The architecture supports:

- **5 Providers**: OpenAI, Anthropic (Claude), Google AI (Gemini), xAI (Grok), OpenRouter
- **Secure credential management**: AES-256-GCM encryption, per-user isolation
- **Streaming support**: NDJSON protocol for real-time token delivery
- **Rate limiting**: Per-user and global throttling with circuit breakers
- **Observability**: Metrics, logging, tracing, error tracking
- **Type safety**: Full TypeScript typing with Zod validation

---

## Architecture

### Component Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)                  │
├─────────────────────────────────────────────────────────────┤
│                       API Routes Layer                        │
│  /api/provider-configs/[provider]  │  /api/llm/stream        │
├─────────────────────────────────────────────────────────────┤
│                 Provider Registry (Lazy Load)                │
│  OpenAI │ Anthropic │ Google AI │ Grok │ OpenRouter         │
├─────────────────────────────────────────────────────────────┤
│              Configuration Manager (Encrypted)               │
│            Prisma ORM + SQLite/PostgreSQL                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File Path | Purpose |
|-----------|---------|
| `services/llm-providers/base-provider.ts` | Abstract provider interface & utilities |
| `services/llm-providers/registry.ts` | Provider instantiation & metadata |
| `services/llm-providers/{provider}-service.ts` | Provider-specific implementations |
| `lib/config-manager.ts` | Configuration persistence & retrieval |
| `lib/crypto.ts` / `lib/crypto-enterprise.ts` | Encryption utilities |
| `app/api/provider-configs/[provider]/route.ts` | Config CRUD endpoints |
| `app/api/llm/stream/route.ts` | Streaming chat endpoint |
| `app/api/llm/chat/route.ts` | Non-streaming chat endpoint |

---

## Provider Integration

### Supported Providers

| Provider | ID | Models | Context | Streaming | Pricing (per 1M tokens) |
|----------|-----|--------|---------|-----------|------------------------|
| **OpenAI** | `openai` | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo | 128K | ✅ | $0.15-$30 |
| **Anthropic** | `anthropic` | Claude 3.5 Sonnet, Opus, Haiku | 200K | ✅ | $0.25-$75 |
| **Google AI** | `google-ai` | Gemini 1.5 Pro, Flash, Pro | 1M | ✅ | $0.075-$5 |
| **xAI Grok** | `grok` | Grok Beta, Grok 2 | 131K | ✅ | Custom |
| **OpenRouter** | `openrouter` | 100+ models (proxy) | Varies | ✅ | Varies |

### Provider Metadata

Each provider exposes metadata without instantiation:

```typescript
import { getProviderMetadata } from '@/services/llm-providers/registry'

const metadata = getProviderMetadata('anthropic')
// {
//   id: 'anthropic',
//   name: 'Anthropic',
//   label: 'Claude',
//   models: [ ... ],
//   supportsStreaming: true,
//   supportsSystemPrompt: true,
//   maxContextLength: 200000,
//   rateLimitNotes: '4K RPM (tier 1)',
//   website: 'https://anthropic.com'
// }
```

### Adding a New Provider

1. **Create service class** in `services/llm-providers/`
2. **Implement `ILLMProvider` interface** from `base-provider.ts`
3. **Register in `registry.ts`** with metadata & factory
4. **Update `validProviders` enum** in API routes
5. **Add default models** in `lib/config-schemas.ts`

**Example skeleton:**

```typescript
// services/llm-providers/newprovider-service.ts
import { BaseLLMProvider, ProviderMetadata, ChatRequest, ChatChunk, ChatResponse } from './base-provider'

export class NewProviderService extends BaseLLMProvider {
  protected metadata: ProviderMetadata = {
    id: 'newprovider',
    name: 'NewProvider',
    label: 'NewProvider',
    models: [{ id: 'model-1', name: 'Model 1', maxTokens: 4096 }],
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextLength: 32768
  }

  async testConnection(apiKey: string, baseUrl?: string) {
    // Implement connectivity test
  }

  async *streamChat(request: ChatRequest, apiKey: string, baseUrl?: string) {
    // Implement streaming logic
  }

  async chat(request: ChatRequest, apiKey: string, baseUrl?: string) {
    // Implement non-streaming logic
  }

  async getModels(apiKey?: string) {
    return this.metadata.models
  }
}
```

---

## API Endpoints

### 1. Provider Configuration Management

#### **GET** `/api/provider-configs/[provider]`

Retrieve configuration status for a provider.

**Auth**: Required (NextAuth session)

**Parameters:**
- `provider` (path) - Provider ID (`openai`, `anthropic`, etc.)

**Response:**
```json
{
  "provider": "openai",
  "configured": true,
  "hasValidKey": true,
  "isActive": true,
  "baseUrl": null,
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "rateLimits": { "requests": 60, "window": 60000 },
  "settings": {}
}
```

**Status Codes:**
- `200 OK` - Configuration found
- `404 Not Found` - No configuration exists
- `401 Unauthorized` - Not authenticated

---

#### **POST** `/api/provider-configs/[provider]`

Create new provider configuration (with connection test).

**Auth**: Required

**Request Body:**
```json
{
  "apiKey": "sk-ant-api03-...",
  "baseUrl": "https://api.anthropic.com",  // optional
  "models": ["claude-3-5-sonnet-20241022"],  // optional
  "rateLimits": { "requests": 60, "window": 60000 },  // optional
  "isActive": true,  // optional
  "settings": {}  // optional provider-specific settings
}
```

**Response:**
```json
{
  "success": true,
  "provider": "anthropic",
  "message": "Configuration created successfully",
  "warnings": []
}
```

**Status Codes:**
- `201 Created` - Configuration saved
- `400 Bad Request` - Validation failed or connection test failed
- `401 Unauthorized` - Not authenticated

---

#### **PUT** `/api/provider-configs/[provider]`

Update existing provider configuration (partial updates allowed).

**Auth**: Required

**Request Body:**
```json
{
  "apiKey": "sk-new-key",  // optional
  "models": ["claude-3-haiku-20240307"]  // optional
}
```

**Response:**
```json
{
  "success": true,
  "provider": "anthropic",
  "message": "Configuration updated successfully"
}
```

**Status Codes:**
- `200 OK` - Updated successfully
- `400 Bad Request` - Validation failed
- `404 Not Found` - Provider config doesn't exist

---

#### **DELETE** `/api/provider-configs/[provider]`

Remove provider configuration.

**Auth**: Required

**Response:**
```json
{
  "success": true,
  "provider": "anthropic",
  "message": "Configuration for anthropic deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Deleted
- `404 Not Found` - Config not found

---

### 2. Chat & Streaming

#### **POST** `/api/llm/stream`

Stream chat completion tokens in real-time (NDJSON format).

**Auth**: Required

**Request Body:**
```json
{
  "provider": "anthropic",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain async generators in TypeScript." }
  ],
  "options": {
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

**Response Stream (NDJSON):**
```ndjson
{"type":"chunk","content":"Async"}
{"type":"chunk","content":" generators"}
{"type":"chunk","content":" are"}
{"type":"chunk","content":" a"}
{"type":"chunk","content":" powerful"}
{"type":"done"}
```

**Event Types:**
- `chunk` - Partial text token
- `done` - Stream complete
- `error` - Error occurred

**Headers:**
- `Content-Type: application/x-ndjson; charset=utf-8`
- `X-RateLimit-Limit` - Max requests per window
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp (ms)

**Status Codes:**
- `200 OK` - Stream started
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit exceeded

---

#### **POST** `/api/llm/chat`

Non-streaming chat completion (single response).

**Auth**: Required

**Request Body:**
```json
{
  "provider": "openai",
  "messages": [
    { "role": "user", "content": "What is the capital of France?" }
  ],
  "options": {
    "model": "gpt-4o-mini",
    "temperature": 0.3
  }
}
```

**Response:**
```json
{
  "content": "The capital of France is Paris.",
  "finishReason": "stop",
  "usage": {
    "promptTokens": 12,
    "completionTokens": 8,
    "totalTokens": 20
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit exceeded

---

### 3. Provider Metadata

#### **GET** `/api/providers/metadata`

List all available providers with models and capabilities.

**Auth**: Optional

**Response:**
```json
[
  {
    "id": "openai",
    "name": "OpenAI",
    "label": "ChatGPT",
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "maxTokens": 16384,
        "description": "Most capable multimodal model",
        "contextWindow": 128000,
        "pricing": { "input": 2.5, "output": 10 }
      }
    ],
    "supportsStreaming": true,
    "supportsSystemPrompt": true,
    "maxContextLength": 128000,
    "website": "https://openai.com"
  }
]
```

**Status Codes:**
- `200 OK` - Success

---

#### **POST** `/api/providers/[provider]/test`

Test provider credentials without persisting.

**Auth**: Required

**Request Body:**
```json
{
  "apiKey": "sk-test-key",
  "baseUrl": "https://api.openai.com"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "latencyMs": 245
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Status Codes:**
- `200 OK` - Test result returned

---

## Authentication & Security

### Session Management

All API routes require NextAuth session authentication:

```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return unauthorized()
}
```

### API Key Encryption

API keys are encrypted at rest using **AES-256-GCM**:

```typescript
// Encryption (server-side)
import { encryptApiKey } from '@/lib/crypto-enterprise'
const encrypted = await encryptApiKey(rawKey, 'openai')

// Decryption (server-side)
import { decryptApiKey } from '@/lib/crypto-enterprise'
const rawKey = await decryptApiKey(encrypted, 'openai')
```

**Key Rotation:**
- Master encryption key: `PROVIDER_ENCRYPTION_SECRET` (environment variable)
- Rotate every 90 days (configurable via security settings)
- Old keys remain valid during grace period

### Rate Limiting

**Per-User Limits:**
- Default: 60 requests/minute
- Configurable via `RATE_LIMIT_LLM_PER_USER_PER_MIN`

**Global Limits:**
- Default: 600 requests/minute
- Configurable via `RATE_LIMIT_LLM_GLOBAL_PER_MIN`

**Circuit Breaker:**
- Failure threshold: 3 consecutive failures
- Success threshold: 2 consecutive successes
- Reset timeout: 60 seconds

### Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ...`
- `Strict-Transport-Security: ...`

---

## Usage Examples

### 1. Configure Provider (Frontend)

```typescript
// Test connection first
const testResponse = await fetch('/api/providers/anthropic/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'sk-ant-api03-...'
  })
})
const testResult = await testResponse.json()

if (testResult.success) {
  // Save configuration
  const saveResponse = await fetch('/api/provider-configs/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: 'sk-ant-api03-...',
      models: ['claude-3-5-sonnet-20241022']
    })
  })
  const saveResult = await saveResponse.json()
  console.log('Saved:', saveResult.message)
}
```

### 2. Streaming Chat (Frontend)

```typescript
const response = await fetch('/api/llm/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'anthropic',
    messages: [
      { role: 'user', content: 'Write a haiku about TypeScript.' }
    ],
    options: { model: 'claude-3-haiku-20240307', temperature: 0.9 }
  })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n').filter(Boolean)

  for (const line of lines) {
    const event = JSON.parse(line)
    if (event.type === 'chunk') {
      console.log(event.content)  // Render token
    } else if (event.type === 'done') {
      console.log('Stream complete')
    } else if (event.type === 'error') {
      console.error(event.error)
    }
  }
}
```

### 3. Non-Streaming Chat (Backend)

```typescript
import { chatWithProvider } from '@/services/llm-providers/registry'
import { configManager } from '@/lib/config-manager'

async function askQuestion(userId: string, question: string) {
  const config = await configManager.getProviderConfig(userId, 'openai')
  if (!config?.apiKey) {
    throw new Error('OpenAI not configured')
  }

  const response = await chatWithProvider(
    'openai',
    {
      userId,
      provider: 'openai',
      messages: [{ role: 'user', content: question }],
      model: 'gpt-4o-mini',
      temperature: 0.7
    },
    config.apiKey,
    config.baseUrl
  )

  return response.content
}
```

### 4. Server-Side Provider Test

```typescript
import { testProviderConnection } from '@/services/llm-providers/registry'

const result = await testProviderConnection('anthropic', 'sk-ant-api03-...')

if (result.success) {
  console.log(`Connection OK (${result.latencyMs}ms)`)
} else {
  console.error(`Connection failed: ${result.error}`)
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "details": {
      "limit": 60,
      "remaining": 0,
      "resetTime": 1704067200000
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description | Retry Strategy |
|------|-------------|-------------|----------------|
| `INVALID_API_KEY` | 401 | Authentication failed | Check credentials |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Exponential backoff |
| `SERVICE_UNAVAILABLE` | 503 | Provider down | Retry with fallback |
| `VALIDATION_ERROR` | 400 | Invalid input | Fix request data |
| `CIRCUIT_OPEN` | 503 | Circuit breaker tripped | Wait for reset |
| `TIMEOUT` | 504 | Request timeout | Retry with lower load |

### Client-Side Error Handling

```typescript
try {
  const response = await fetch('/api/llm/chat', { ... })
  const data = await response.json()

  if (!response.ok) {
    switch (data.error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        const retryAfter = data.error.details.resetTime - Date.now()
        console.log(`Retry after ${retryAfter}ms`)
        break
      case 'INVALID_API_KEY':
        console.error('Credentials invalid, reconfigure provider')
        break
      default:
        console.error('Error:', data.error.message)
    }
  }
} catch (error) {
  console.error('Network error:', error)
}
```

---

## Testing & Validation

### Unit Tests (Vitest)

```typescript
// test/services/registry.test.ts
import { describe, it, expect } from 'vitest'
import { getProvider, getProviderMetadata } from '@/services/llm-providers/registry'

describe('Provider Registry', () => {
  it('should return provider metadata', () => {
    const meta = getProviderMetadata('openai')
    expect(meta).toBeDefined()
    expect(meta?.id).toBe('openai')
    expect(meta?.supportsStreaming).toBe(true)
  })

  it('should instantiate provider', async () => {
    const provider = await getProvider('anthropic')
    expect(provider).toBeDefined()
    expect(provider?.getMetadata().id).toBe('anthropic')
  })
})
```

### Integration Tests

```typescript
// test/api/provider-configs.test.ts
import { describe, it, expect } from 'vitest'
import { POST, GET } from '@/app/api/provider-configs/[provider]/route'

describe('Provider Config API', () => {
  it('should save configuration', async () => {
    const req = new Request('http://localhost/api/provider-configs/openai', {
      method: 'POST',
      body: JSON.stringify({ apiKey: 'sk-test-key' })
    })
    const res = await POST(req, { params: Promise.resolve({ provider: 'openai' }) })
    expect(res.status).toBe(201)
  })
})
```

### Manual Testing (cURL)

**Test connection:**
```bash
curl -X POST http://localhost:3000/api/providers/anthropic/test \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"apiKey":"sk-ant-api03-..."}'
```

**Stream chat:**
```bash
curl -N -X POST http://localhost:3000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "provider": "openai",
    "messages": [{"role":"user","content":"Hello"}],
    "options": {"model":"gpt-4o-mini"}
  }'
```

---

## Performance & Optimization

### Lazy Loading

Providers are lazy-loaded to reduce initial bundle size:

```typescript
// Only loads when first accessed
const provider = await getProvider('anthropic')
```

### Connection Pooling

Database connections are pooled (configurable via `lib/config-manager.ts`):

```typescript
database: {
  connectionPool: { min: 2, max: 10, acquireTimeoutMillis: 60000 },
  queryTimeout: 30000
}
```

### Caching

- **Provider metadata**: In-memory cache (never expires)
- **User configs**: 5-minute TTL cache in ConfigurationManager
- **Analytics**: Smart cache invalidation on LLM requests

### Streaming Optimization

- **Incremental decoding**: `TextDecoder` with `{ stream: true }`
- **Chunked transfer**: No buffering, direct passthrough
- **Memory cleanup**: Reader lock release in `finally` blocks

### Metrics

All endpoints expose Prometheus-compatible metrics:

```typescript
llm_requests_total{provider="openai",model="gpt-4o",status="success"} 1234
llm_request_duration_seconds{provider="openai",quantile="0.5"} 0.85
llm_tokens_total{provider="openai",type="total"} 456789
```

---

## Troubleshooting

### Common Issues

**1. "API key not configured"**

```bash
# Verify configuration exists
curl -X GET http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=..."

# Expected: { "configured": true, "hasValidKey": true }
```

**Solution:** Run POST to `/api/provider-configs/openai` with valid API key.

---

**2. "Rate limit exceeded"**

**Symptoms:** 429 status with `X-RateLimit-Remaining: 0` header

**Solution:**
1. Check rate limit headers:
   - `X-RateLimit-Limit` - Max requests
   - `X-RateLimit-Reset` - Reset time
2. Implement exponential backoff
3. Increase limits via environment variables

---

**3. "Service unavailable" (503)**

**Causes:**
- Provider API downtime
- Circuit breaker open
- Network connectivity issues

**Solution:**
1. Check provider status page
2. Verify circuit breaker state: `/api/admin/circuit-breakers`
3. Try alternative provider (OpenRouter)
4. Wait for circuit breaker reset (60 seconds)

---

**4. Stream disconnects mid-response**

**Causes:**
- Client timeout
- Provider timeout
- Network interruption

**Solution:**
1. Increase timeout: `AbortSignal.timeout(120000)` (2 min)
2. Implement resume/retry logic
3. Check connection manager: `/api/admin/stream-connections`

---

**5. Decryption errors**

**Symptoms:** "Failed to decrypt data" or "Invalid key"

**Solution:**
1. Verify `PROVIDER_ENCRYPTION_SECRET` environment variable
2. Check encryption version prefix (`v3:AES-256-GCM:`)
3. Re-save provider configuration (triggers re-encryption)

---

### Debug Mode

Enable debug logging:

```bash
export NODE_ENV=development
export DEBUG=true
```

View logs:
```bash
tail -f logs/application.log | grep -i provider
```

---

### Health Checks

**System Health:**
```bash
curl http://localhost:3000/api/health
```

**Provider Status:**
```bash
curl http://localhost:3000/api/providers/health
```

---

## Quick Reference Card

### Essential URLs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/provider-configs/[provider]` | GET | Check config status |
| `/api/provider-configs/[provider]` | POST | Create config |
| `/api/provider-configs/[provider]` | PUT | Update config |
| `/api/provider-configs/[provider]` | DELETE | Remove config |
| `/api/llm/stream` | POST | Stream chat |
| `/api/llm/chat` | POST | Non-stream chat |
| `/api/providers/metadata` | GET | List providers |
| `/api/providers/[provider]/test` | POST | Test credentials |

### Environment Variables

```bash
# Required
DATABASE_URL=file:./dev.db
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
PROVIDER_ENCRYPTION_SECRET=<encryption-key>

# Optional
RATE_LIMIT_LLM_PER_USER_PER_MIN=60
RATE_LIMIT_LLM_GLOBAL_PER_MIN=600
RATE_LIMIT_LLM_WINDOW_MS=60000
```

### Provider IDs

```typescript
'openai' | 'anthropic' | 'google-ai' | 'grok' | 'openrouter'
```

---

## Support & Resources

- **Documentation**: `/docs`
- **Issue Tracker**: GitHub Issues
- **Provider Status**:
  - OpenAI: https://status.openai.com
  - Anthropic: https://status.anthropic.com
  - Google AI: https://status.cloud.google.com
  - xAI: https://status.x.ai

---

**Last Updated:** 2025-01-07
**Version:** 1.0.0
**Maintainer:** RealMultiLLM Team
