# API Testing Examples

**Comprehensive collection of cURL, JavaScript, and automated test examples.**

---

## Table of Contents

1. [cURL Examples](#curl-examples)
2. [JavaScript/TypeScript Examples](#javascripttypescript-examples)
3. [Automated Test Suite](#automated-test-suite)
4. [Load Testing](#load-testing)
5. [Security Testing](#security-testing)

---

## cURL Examples

### 1. Test Provider Connection

```bash
# Test OpenAI
curl -X POST http://localhost:3000/api/providers/openai/test \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "apiKey": "sk-proj-..."
  }'

# Expected response:
# {"success":true,"latencyMs":245}
```

### 2. Create Provider Configuration

```bash
curl -X POST http://localhost:3000/api/provider-configs/anthropic \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "apiKey": "sk-ant-api03-...",
    "models": ["claude-3-5-sonnet-20241022"],
    "isActive": true
  }'

# Expected response:
# {"success":true,"provider":"anthropic","message":"Configuration created successfully"}
```

### 3. Get Provider Configuration

```bash
curl -X GET http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected response:
# {
#   "provider": "openai",
#   "configured": true,
#   "hasValidKey": true,
#   "isActive": true,
#   "models": ["gpt-4o", "gpt-3.5-turbo"],
#   "rateLimits": { "requests": 60, "window": 60000 }
# }
```

### 4. Update Provider Configuration

```bash
curl -X PUT http://localhost:3000/api/provider-configs/openai \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "models": ["gpt-4o-mini"]
  }'
```

### 5. Delete Provider Configuration

```bash
curl -X DELETE http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected response:
# {"success":true,"provider":"openai","message":"Configuration for openai deleted successfully"}
```

### 6. Stream Chat (NDJSON)

```bash
curl -N -X POST http://localhost:3000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "provider": "anthropic",
    "messages": [
      {"role": "user", "content": "Write a haiku about TypeScript"}
    ],
    "options": {
      "model": "claude-3-haiku-20240307",
      "temperature": 0.9
    }
  }'

# Expected stream:
# {"type":"chunk","content":"Types"}
# {"type":"chunk","content":" compile"}
# {"type":"chunk","content":" to"}
# {"type":"chunk","content":" JavaScript"}
# {"type":"done"}
```

### 7. Non-Streaming Chat

```bash
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "provider": "openai",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "options": {
      "model": "gpt-4o-mini",
      "temperature": 0.3
    }
  }'

# Expected response:
# {
#   "content": "2 + 2 equals 4.",
#   "finishReason": "stop",
#   "usage": {
#     "promptTokens": 10,
#     "completionTokens": 8,
#     "totalTokens": 18
#   }
# }
```

### 8. Get All Provider Metadata

```bash
curl -X GET http://localhost:3000/api/providers/metadata

# Expected response (array of provider metadata):
# [
#   {
#     "id": "openai",
#     "name": "OpenAI",
#     "label": "ChatGPT",
#     "models": [...],
#     "supportsStreaming": true,
#     "maxContextLength": 128000
#   },
#   ...
# ]
```

---

## JavaScript/TypeScript Examples

### 1. Test All Providers

```typescript
async function testAllProviders() {
  const providers = ['openai', 'anthropic', 'google-ai', 'grok', 'openrouter']
  const results = []

  for (const provider of providers) {
    try {
      // Check if configured
      const configResponse = await fetch(`/api/provider-configs/${provider}`, {
        credentials: 'include'
      })
      const config = await configResponse.json()

      if (!config.configured) {
        results.push({ provider, status: 'not-configured' })
        continue
      }

      // Test chat
      const chatResponse = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          messages: [{ role: 'user', content: 'Hello!' }]
        })
      })

      if (chatResponse.ok) {
        results.push({ provider, status: 'working' })
      } else {
        results.push({ provider, status: 'error', error: chatResponse.statusText })
      }
    } catch (error) {
      results.push({ provider, status: 'error', error: error.message })
    }
  }

  return results
}

// Usage
testAllProviders().then(results => {
  console.table(results)
})
```

### 2. Streaming Chat with React Hooks

```typescript
import { useState, useCallback } from 'react'

function useStreamingChat() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (
    provider: string,
    messages: Array<{ role: string; content: string }>,
    options?: any
  ) => {
    setLoading(true)
    setMessage('')
    setError(null)

    try {
      const response = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, messages, options })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Request failed')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          const event = JSON.parse(line)

          if (event.type === 'chunk') {
            setMessage(prev => prev + event.content)
          } else if (event.type === 'error') {
            throw new Error(event.error)
          }
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { message, loading, error, sendMessage }
}

// Usage in component
function ChatComponent() {
  const { message, loading, sendMessage } = useStreamingChat()

  return (
    <div>
      <button
        onClick={() => sendMessage('anthropic', [
          { role: 'user', content: 'Write a poem' }
        ])}
        disabled={loading}
      >
        Send
      </button>
      <div>{message}</div>
    </div>
  )
}
```

### 3. Configuration Management

```typescript
interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  models?: string[]
  isActive?: boolean
}

class ProviderConfigManager {
  async testConnection(provider: string, apiKey: string): Promise<boolean> {
    const response = await fetch(`/api/providers/${provider}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ apiKey })
    })

    const result = await response.json()
    return result.success
  }

  async saveConfig(provider: string, config: ProviderConfig): Promise<void> {
    const response = await fetch(`/api/provider-configs/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to save configuration')
    }
  }

  async getConfig(provider: string) {
    const response = await fetch(`/api/provider-configs/${provider}`, {
      credentials: 'include'
    })

    if (response.ok) {
      return await response.json()
    }

    return null
  }

  async deleteConfig(provider: string): Promise<void> {
    const response = await fetch(`/api/provider-configs/${provider}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to delete configuration')
    }
  }
}

// Usage
const manager = new ProviderConfigManager()

// Test and save
const apiKey = 'sk-ant-api03-...'
const isValid = await manager.testConnection('anthropic', apiKey)

if (isValid) {
  await manager.saveConfig('anthropic', {
    apiKey,
    models: ['claude-3-5-sonnet-20241022']
  })
  console.log('Configuration saved!')
}
```

### 4. Multi-Provider Chat with Fallback

```typescript
async function chatWithFallback(
  messages: Array<{ role: string; content: string }>,
  providers: string[] = ['anthropic', 'openai', 'google-ai']
) {
  for (const provider of providers) {
    try {
      console.log(`Trying ${provider}...`)

      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, messages })
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`✅ Success with ${provider}`)
        return { provider, ...result }
      }

      console.warn(`⚠️  ${provider} failed: ${response.statusText}`)
    } catch (error) {
      console.error(`❌ ${provider} error:`, error)
    }
  }

  throw new Error('All providers failed')
}

// Usage
try {
  const result = await chatWithFallback([
    { role: 'user', content: 'Explain quantum computing' }
  ])
  console.log('Response:', result.content)
  console.log('From:', result.provider)
} catch (error) {
  console.error('All providers failed:', error)
}
```

---

## Automated Test Suite

### Integration Test: Provider Configuration Lifecycle

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Provider Configuration Lifecycle', () => {
  const provider = 'openai'
  const testApiKey = process.env.OPENAI_API_KEY || 'sk-test-key'
  let sessionToken: string

  beforeAll(async () => {
    // Login and get session token
    const loginResponse = await fetch('http://localhost:3000/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    })
    const cookies = loginResponse.headers.get('set-cookie')
    sessionToken = cookies?.match(/next-auth.session-token=([^;]+)/)?.[1] || ''
  })

  afterAll(async () => {
    // Cleanup: delete configuration
    await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      method: 'DELETE',
      headers: { Cookie: `next-auth.session-token=${sessionToken}` }
    })
  })

  it('should create provider configuration', async () => {
    const response = await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=${sessionToken}`
      },
      body: JSON.stringify({
        apiKey: testApiKey,
        models: ['gpt-4o-mini']
      })
    })

    expect(response.status).toBe(201)
    const result = await response.json()
    expect(result.success).toBe(true)
  })

  it('should retrieve configuration', async () => {
    const response = await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      headers: { 'Cookie': `next-auth.session-token=${sessionToken}` }
    })

    expect(response.status).toBe(200)
    const config = await response.json()
    expect(config.configured).toBe(true)
    expect(config.hasValidKey).toBe(true)
  })

  it('should update configuration', async () => {
    const response = await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=${sessionToken}`
      },
      body: JSON.stringify({
        models: ['gpt-4o', 'gpt-3.5-turbo']
      })
    })

    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
  })

  it('should delete configuration', async () => {
    const response = await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      method: 'DELETE',
      headers: { 'Cookie': `next-auth.session-token=${sessionToken}` }
    })

    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
  })

  it('should return 404 after deletion', async () => {
    const response = await fetch(`http://localhost:3000/api/provider-configs/${provider}`, {
      headers: { 'Cookie': `next-auth.session-token=${sessionToken}` }
    })

    expect(response.status).toBe(404)
  })
})
```

---

## Load Testing

### Artillery Configuration

```yaml
# artillery-load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests/second
      name: "Sustained load"
    - duration: 120
      arrivalRate: 50  # Ramp up to 50 requests/second
      name: "Peak load"
  variables:
    sessionToken: "YOUR_SESSION_TOKEN"

scenarios:
  - name: "Stream Chat"
    flow:
      - post:
          url: "/api/llm/stream"
          headers:
            Content-Type: "application/json"
            Cookie: "next-auth.session-token={{ sessionToken }}"
          json:
            provider: "openai"
            messages:
              - role: "user"
                content: "Hello!"
            options:
              model: "gpt-4o-mini"

  - name: "Non-Stream Chat"
    flow:
      - post:
          url: "/api/llm/chat"
          headers:
            Content-Type: "application/json"
            Cookie: "next-auth.session-token={{ sessionToken }}"
          json:
            provider: "anthropic"
            messages:
              - role: "user"
                content: "Test message"
```

Run load test:
```bash
npm install -g artillery
artillery run artillery-load-test.yml
```

### Custom Load Test Script

```typescript
// load-test.ts
async function loadTest(concurrency: number, duration: number) {
  const startTime = Date.now()
  const results = {
    total: 0,
    success: 0,
    failure: 0,
    rateLimited: 0,
    avgLatency: 0,
    latencies: [] as number[]
  }

  const worker = async () => {
    while (Date.now() - startTime < duration) {
      const reqStart = Date.now()
      results.total++

      try {
        const response = await fetch('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `next-auth.session-token=${process.env.SESSION_TOKEN}`
          },
          body: JSON.stringify({
            provider: 'openai',
            messages: [{ role: 'user', content: 'Test' }]
          })
        })

        const latency = Date.now() - reqStart
        results.latencies.push(latency)

        if (response.status === 429) {
          results.rateLimited++
        } else if (response.ok) {
          results.success++
        } else {
          results.failure++
        }
      } catch (error) {
        results.failure++
      }
    }
  }

  // Spawn workers
  await Promise.all(
    Array(concurrency).fill(null).map(() => worker())
  )

  // Calculate statistics
  results.avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length
  results.latencies.sort((a, b) => a - b)
  const p50 = results.latencies[Math.floor(results.latencies.length * 0.5)]
  const p95 = results.latencies[Math.floor(results.latencies.length * 0.95)]
  const p99 = results.latencies[Math.floor(results.latencies.length * 0.99)]

  console.log('Load Test Results:')
  console.log(`Total requests: ${results.total}`)
  console.log(`Success: ${results.success} (${(results.success / results.total * 100).toFixed(1)}%)`)
  console.log(`Failure: ${results.failure}`)
  console.log(`Rate limited: ${results.rateLimited}`)
  console.log(`Avg latency: ${results.avgLatency.toFixed(0)}ms`)
  console.log(`P50 latency: ${p50}ms`)
  console.log(`P95 latency: ${p95}ms`)
  console.log(`P99 latency: ${p99}ms`)
}

// Run: 10 concurrent workers for 60 seconds
loadTest(10, 60000)
```

---

## Security Testing

### 1. Test Authentication

```bash
# Without session token (should fail)
curl -X GET http://localhost:3000/api/provider-configs/openai

# Expected: 401 Unauthorized
```

### 2. Test Authorization

```bash
# Try to access another user's config (should fail)
curl -X GET http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=ANOTHER_USERS_TOKEN"

# Expected: 404 (config not found for this user)
```

### 3. Test Injection Attacks

```bash
# SQL injection attempt
curl -X POST http://localhost:3000/api/provider-configs/openai \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "apiKey": "sk-test OR 1=1--"
  }'

# Expected: 400 (validation error) or encrypted safely
```

### 4. Test Rate Limiting

```bash
# Rapid-fire 100 requests
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/llm/chat \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
    -d '{"provider":"openai","messages":[{"role":"user","content":"Test"}]}' &
done
wait

# Expected: Many 429 responses after rate limit hit
```

---

**Need More Examples?**
- Check test files: `test/services/*.test.ts`
- Review API routes: `app/api/**/*.ts`
- See component usage: `components/**/*.tsx`

---

**Last Updated:** 2025-01-07
