# API Endpoint Reference

## Overview

Complete reference for all RealMultiLLM API endpoints related to provider management, API key handling, and LLM interactions.

## Table of Contents

1. [Authentication](#authentication)
2. [Provider Configuration Endpoints](#provider-configuration-endpoints)
3. [API Key Testing Endpoints](#api-key-testing-endpoints)
4. [LLM Interaction Endpoints](#llm-interaction-endpoints)
5. [Model Discovery Endpoints](#model-discovery-endpoints)
6. [Analytics Endpoints](#analytics-endpoints)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All endpoints (except test endpoints) require authentication via NextAuth.js session cookie.

### Session Cookie

```http
Cookie: next-auth.session-token=<session-token>
```

### Response for Unauthorized Requests

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Status Code:** `401 Unauthorized`

---

## Provider Configuration Endpoints

### GET /api/provider-configs

Retrieve all provider configurations for the authenticated user.

#### Request

```http
GET /api/provider-configs HTTP/1.1
Host: localhost:3000
Cookie: next-auth.session-token=<session-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "configs": [
    {
      "id": "clxxx123...",
      "provider": "openai",
      "isActive": true,
      "settings": {
        "defaultModel": "gpt-4o",
        "temperature": 0.7,
        "maxTokens": 4096
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "clxxx456...",
      "provider": "claude",
      "isActive": true,
      "settings": {
        "defaultModel": "claude-3-opus-20240229",
        "temperature": 0.7
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Notes

- API keys are **never** returned in responses
- Only active configurations are returned
- Settings are provider-specific

#### Example Usage

```bash
curl -X GET http://localhost:3000/api/provider-configs \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

```typescript
// TypeScript client
const response = await fetch('/api/provider-configs', {
  credentials: 'include',
});

const data = await response.json();
console.log(data.configs);
```

---

### POST /api/provider-configs

Create or update a provider configuration with API key.

#### Request

```http
POST /api/provider-configs HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: next-auth.session-token=<session-token>

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

#### Request Body Schema

```typescript
{
  provider: string;         // Required: Provider ID
  apiKey: string;          // Required: API key (will be encrypted)
  settings?: {             // Optional: Provider settings
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
}
```

#### Response

**Status:** `200 OK`

```json
{
  "config": {
    "id": "clxxx123...",
    "provider": "openai",
    "isActive": true,
    "settings": {
      "defaultModel": "gpt-4o",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Validation Errors

**Status:** `400 Bad Request`

```json
{
  "error": "Invalid configuration data",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["apiKey"],
      "message": "API key is required"
    }
  ]
}
```

#### Valid Providers

- `openai`
- `anthropic` / `claude`
- `google` / `google-ai`
- `openrouter`
- `github`
- `llama`
- `grok`
- `huggingface`
- `cohere`
- `mistral`
- `together`

#### Example Usage

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "settings": {
      "defaultModel": "gpt-4o",
      "temperature": 0.7
    }
  }'
```

```typescript
// TypeScript client
const response = await fetch('/api/provider-configs', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'openai',
    apiKey: 'sk-...',
    settings: {
      defaultModel: 'gpt-4o',
      temperature: 0.7,
    },
  }),
});

const data = await response.json();
console.log(data.config);
```

---

### PUT /api/provider-configs

Update provider settings without changing API key.

#### Request

```http
PUT /api/provider-configs HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: next-auth.session-token=<session-token>

{
  "provider": "openai",
  "settings": {
    "defaultModel": "gpt-4o-mini",
    "temperature": 0.5,
    "maxTokens": 2048
  }
}
```

#### Request Body Schema

```typescript
{
  provider: string;        // Required: Provider ID
  settings: {              // Required: Settings to update
    [key: string]: any;
  };
}
```

#### Response

**Status:** `200 OK`

```json
{
  "config": {
    "id": "clxxx123...",
    "provider": "openai",
    "isActive": true,
    "settings": {
      "defaultModel": "gpt-4o-mini",
      "temperature": 0.5,
      "maxTokens": 2048
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Not Found

**Status:** `404 Not Found`

```json
{
  "error": "Provider configuration not found"
}
```

#### Example Usage

```bash
curl -X PUT http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "openai",
    "settings": {
      "temperature": 0.5
    }
  }'
```

---

### DELETE /api/provider-configs/[provider]

Delete (deactivate) a provider configuration.

#### Request

```http
DELETE /api/provider-configs/openai HTTP/1.1
Host: localhost:3000
Cookie: next-auth.session-token=<session-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Provider configuration deleted"
}
```

#### Example Usage

```bash
curl -X DELETE http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

---

## API Key Testing Endpoints

### POST /api/test-api-key

Test an API key before storing it.

#### Request

```http
POST /api/test-api-key HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "provider": "openai",
  "apiKey": "sk-..."
}
```

#### Request Body Schema

```typescript
{
  provider: string;  // Required: Provider ID
  apiKey: string;    // Required: API key to test
}
```

#### Response (Success)

**Status:** `200 OK`

```json
{
  "valid": true,
  "message": "API key is valid"
}
```

#### Response (Invalid)

**Status:** `200 OK`

```json
{
  "valid": false,
  "message": "Invalid OpenAI API key: Incorrect API key provided"
}
```

#### Response (Unsupported Provider)

**Status:** `400 Bad Request`

```json
{
  "error": "Unsupported provider: unknown-provider"
}
```

#### Response (Missing Input)

**Status:** `400 Bad Request`

```json
{
  "error": "Provider and API key are required"
}
```

#### Provider-Specific Testing

Each provider uses different validation methods:

| Provider | Test Endpoint | Method |
|----------|--------------|--------|
| OpenAI | `GET /v1/models` | List models |
| Claude | `POST /v1/messages` | Send test message |
| Google AI | `GET /v1beta/models` | List models |
| OpenRouter | `GET /api/v1/models` | List models |
| Hugging Face | Format validation | Check token format |

#### Example Usage

```bash
# Test OpenAI key
curl -X POST http://localhost:3000/api/test-api-key \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-..."
  }'

# Test Claude key
curl -X POST http://localhost:3000/api/test-api-key \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "claude",
    "apiKey": "sk-ant-..."
  }'
```

```typescript
// TypeScript client
async function testApiKey(provider: string, apiKey: string) {
  const response = await fetch('/api/test-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });

  const data = await response.json();
  return data.valid;
}

// Usage
const isValid = await testApiKey('openai', 'sk-...');
if (isValid) {
  console.log('API key is valid!');
}
```

---

## LLM Interaction Endpoints

### POST /api/llm/stream

Stream chat completions from LLM providers.

#### Request

```http
POST /api/llm/stream HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: next-auth.session-token=<session-token>

{
  "provider": "openai",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "options": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

#### Request Body Schema

```typescript
{
  provider: string;              // Required: Provider ID
  messages: Array<{              // Required: Conversation history
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  options?: {                    // Optional: Generation options
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  };
}
```

#### Response

**Content-Type:** `application/x-ndjson; charset=utf-8`

Stream of newline-delimited JSON objects:

```json
{"type":"chunk","content":"Hello"}
{"type":"chunk","content":"!"}
{"type":"chunk","content":" I'm"}
{"type":"chunk","content":" doing"}
{"type":"chunk","content":" great"}
{"type":"chunk","content":"."}
{"type":"done"}
```

#### Event Types

| Type | Description | Data |
|------|-------------|------|
| `chunk` | Text chunk | `{ content: string }` |
| `done` | Stream complete | `{}` |
| `error` | Error occurred | `{ error: string }` |
| `aborted` | Request aborted | `{}` |

#### Error Response

```json
{"type":"error","error":"Provider configuration not found"}
```

#### Rate Limit Response

**Status:** `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "retryAfterMs": 30000,
  "remaining": 0
}
```

#### Example Usage

```bash
# cURL (stream to console)
curl -N -X POST http://localhost:3000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "openai",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "options": {
      "model": "gpt-4o",
      "temperature": 0.7
    }
  }'
```

```typescript
// TypeScript client with streaming
async function streamChat(
  provider: string,
  messages: Array<{ role: string; content: string }>,
  options?: any
) {
  const response = await fetch('/api/llm/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, messages, options }),
  });

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const event = JSON.parse(line);

      switch (event.type) {
        case 'chunk':
          process.stdout.write(event.content);
          break;
        case 'done':
          console.log('\n[Complete]');
          return;
        case 'error':
          throw new Error(event.error);
        case 'aborted':
          console.log('\n[Aborted]');
          return;
      }
    }
  }
}

// Usage
await streamChat(
  'openai',
  [{ role: 'user', content: 'Explain quantum computing' }],
  { model: 'gpt-4o', temperature: 0.7 }
);
```

```typescript
// React component example
function ChatComponent() {
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    setStreaming(true);
    let fullResponse = '';

    try {
      const response = await fetch('/api/llm/stream', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content }],
          options: { model: 'gpt-4o' },
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          const event = JSON.parse(line);

          if (event.type === 'chunk') {
            fullResponse += event.content;
            setMessages(prev => [...prev.slice(0, -1), fullResponse]);
          } else if (event.type === 'done') {
            break;
          }
        }
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')} disabled={streaming}>
        Send
      </button>
    </div>
  );
}
```

---

## Model Discovery Endpoints

### GET /api/llm/models

Get available models for configured providers.

#### Request

```http
GET /api/llm/models HTTP/1.1
Host: localhost:3000
Cookie: next-auth.session-token=<session-token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | string | No | Filter by provider |

#### Response

**Status:** `200 OK`

```json
{
  "models": [
    {
      "id": "gpt-4o",
      "name": "GPT-4 Omni",
      "provider": "openai",
      "contextWindow": 128000,
      "capabilities": ["text", "code", "reasoning", "multimodal"]
    },
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4 Omni Mini",
      "provider": "openai",
      "contextWindow": 128000,
      "capabilities": ["text", "code", "reasoning"]
    }
  ]
}
```

#### Example Usage

```bash
# Get all models
curl http://localhost:3000/api/llm/models \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"

# Get OpenAI models only
curl http://localhost:3000/api/llm/models?provider=openai \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

---

### GET /api/openrouter/models

Get available models from OpenRouter (dynamic list).

#### Request

```http
GET /api/openrouter/models HTTP/1.1
Host: localhost:3000
Cookie: next-auth.session-token=<session-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "models": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4 Omni",
      "description": "OpenAI's most capable model",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.000005",
        "completion": "0.000015"
      }
    }
  ]
}
```

#### Example Usage

```bash
curl http://localhost:3000/api/openrouter/models \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

---

## Analytics Endpoints

### POST /api/analytics

Track usage events.

#### Request

```http
POST /api/analytics HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: next-auth.session-token=<session-token>

{
  "event": "llm.request",
  "payload": {
    "provider": "openai",
    "model": "gpt-4o",
    "tokens": {
      "prompt": 100,
      "completion": 50,
      "total": 150
    },
    "duration": 1234
  }
}
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "id": "clxxx789..."
}
```

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": { ... }  // Optional additional details
}
```

### Common Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful request |
| `400` | Bad Request | Invalid input, validation errors |
| `401` | Unauthorized | Missing or invalid authentication |
| `404` | Not Found | Resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

### Error Examples

#### 400 Bad Request

```json
{
  "error": "Invalid configuration data",
  "details": [
    {
      "code": "invalid_type",
      "path": ["apiKey"],
      "message": "API key is required"
    }
  ]
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests",
  "retryAfterMs": 30000,
  "remaining": 0
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

### Limits

| Endpoint | Per User | Global | Window |
|----------|----------|--------|--------|
| `/api/llm/stream` | 60 | 600 | 1 minute |
| `/api/test-api-key` | 10 | 100 | 1 minute |
| `/api/provider-configs` | 30 | 300 | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1609459200
```

### Rate Limit Response

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests",
  "retryAfterMs": 30000,
  "remaining": 0
}
```

### Handling Rate Limits

```typescript
async function callWithRetry(fn: () => Promise<Response>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fn();

    if (response.status !== 429) {
      return response;
    }

    const data = await response.json();
    const retryAfter = data.retryAfterMs || 1000 * (i + 1);

    await new Promise(resolve => setTimeout(resolve, retryAfter));
  }

  throw new Error('Max retries exceeded');
}

// Usage
const response = await callWithRetry(() =>
  fetch('/api/llm/stream', { ... })
);
```

---

## Webhook Endpoints (Future)

### POST /api/webhooks/provider-status

Receive provider status updates.

_Coming soon_

---

## Additional Resources

- [Provider Integration Guide](./PROVIDER_INTEGRATION.md)
- [API Key Management Guide](./API_KEY_MANAGEMENT.md)
- [Provider Setup Guide](./PROVIDER_SETUP_GUIDE.md)
- [OpenAPI Specification](#) _(coming soon)_
- [Postman Collection](#) _(coming soon)_

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-01 | Initial API release |
| 1.1.0 | 2024-02-01 | Added streaming support |
| 1.2.0 | 2024-03-01 | Added model discovery |

---

## Support

For API issues or questions:

1. Check this reference documentation
2. Review [GitHub Issues](https://github.com/your-repo/issues)
3. Join [Discord Community](#)
4. Contact support@realmultillm.com
