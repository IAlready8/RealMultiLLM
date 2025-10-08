# Provider Quick Start Guide

**Get up and running with LLM providers in 5 minutes.**

---

## Prerequisites

- Next.js application running (`npm run dev`)
- User account with active session
- At least one provider API key

---

## Step 1: Obtain API Keys

### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy key starting with `sk-proj-`

### Anthropic (Claude)
1. Visit https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy key starting with `sk-ant-`

### Google AI (Gemini)
1. Visit https://aistudio.google.com/app/apikey
2. Click "Get API key"
3. Copy key (alphanumeric)

### xAI (Grok)
1. Visit https://console.x.ai
2. Navigate to API Keys
3. Generate new key

### OpenRouter
1. Visit https://openrouter.ai/keys
2. Create API key
3. Copy key starting with `sk-or-`

---

## Step 2: Configure Provider (Frontend)

### Using Settings UI

1. Navigate to `/settings`
2. Click **"API Keys"** tab
3. Select provider (e.g., "Anthropic")
4. Enter API key
5. Click **"Test Connection"**
6. If successful, click **"Save"**

### Using API Directly

```typescript
// Save configuration
const response = await fetch('/api/provider-configs/anthropic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    apiKey: 'sk-ant-api03-...',
    models: ['claude-3-5-sonnet-20241022'],  // optional
    isActive: true
  })
})

const result = await response.json()
if (result.success) {
  console.log('✅ Provider configured:', result.message)
} else {
  console.error('❌ Configuration failed:', result.error)
}
```

---

## Step 3: Send Your First Request

### Streaming Chat

```typescript
// Start streaming chat
const response = await fetch('/api/llm/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    provider: 'anthropic',
    messages: [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'Write a quicksort algorithm in TypeScript.' }
    ],
    options: {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 2048
    }
  })
})

// Parse NDJSON stream
const reader = response.body.getReader()
const decoder = new TextDecoder()
let fullResponse = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n').filter(Boolean)

  for (const line of lines) {
    const event = JSON.parse(line)

    switch (event.type) {
      case 'chunk':
        fullResponse += event.content
        console.log(event.content)  // Print token
        break
      case 'done':
        console.log('\n✅ Stream complete')
        break
      case 'error':
        console.error('❌ Error:', event.error)
        break
    }
  }
}

console.log('Full response:', fullResponse)
```

### Non-Streaming Chat

```typescript
const response = await fetch('/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    provider: 'openai',
    messages: [
      { role: 'user', content: 'What is 2+2?' }
    ],
    options: {
      model: 'gpt-4o-mini',
      temperature: 0.3
    }
  })
})

const result = await response.json()
console.log('Answer:', result.content)
console.log('Tokens used:', result.usage.totalTokens)
```

---

## Step 4: Handle Errors

```typescript
try {
  const response = await fetch('/api/llm/chat', { ... })
  const data = await response.json()

  if (!response.ok) {
    switch (response.status) {
      case 401:
        console.error('Not authenticated - please log in')
        break
      case 404:
        console.error('Provider not configured')
        // Redirect to settings
        window.location.href = '/settings?tab=api-keys'
        break
      case 429:
        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset'))
        const waitSeconds = Math.ceil((resetTime - Date.now()) / 1000)
        console.warn(`Rate limited - retry in ${waitSeconds}s`)
        break
      case 400:
        console.error('Invalid request:', data.error.message)
        break
      default:
        console.error('Unexpected error:', data.error)
    }
    return
  }

  // Success
  console.log('Response:', data.content)

} catch (error) {
  console.error('Network error:', error)
}
```

---

## Step 5: Monitor Usage

### Check Rate Limits

```typescript
const response = await fetch('/api/llm/stream', { ... })

// Read headers
const limit = response.headers.get('X-RateLimit-Limit')
const remaining = response.headers.get('X-RateLimit-Remaining')
const reset = response.headers.get('X-RateLimit-Reset')

console.log(`Requests: ${remaining}/${limit}`)
console.log(`Resets at: ${new Date(parseInt(reset))}`)
```

### View Analytics

```typescript
// Get usage stats
const response = await fetch('/api/analytics/usage', {
  credentials: 'include'
})
const stats = await response.json()

console.log('Total requests:', stats.totalRequests)
console.log('Tokens used:', stats.totalTokens)
console.log('By provider:', stats.byProvider)
```

---

## Common Patterns

### Multi-Provider Fallback

```typescript
const providers = ['anthropic', 'openai', 'google-ai']

async function chatWithFallback(messages) {
  for (const provider of providers) {
    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, messages })
      })

      if (response.ok) {
        return await response.json()
      }

      console.warn(`${provider} failed, trying next...`)
    } catch (error) {
      console.error(`${provider} error:`, error)
    }
  }

  throw new Error('All providers failed')
}
```

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      const delay = Math.min(1000 * Math.pow(2, i), 10000)
      console.log(`Retry ${i + 1} after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Usage
const result = await retryWithBackoff(() =>
  fetch('/api/llm/chat', { ... }).then(r => r.json())
)
```

### Streaming to React Component

```tsx
import { useState } from 'react'

function ChatBox() {
  const [message, setMessage] = useState('')
  const [streaming, setStreaming] = useState(false)

  async function sendMessage() {
    setStreaming(true)
    setMessage('')

    const response = await fetch('/api/llm/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        provider: 'anthropic',
        messages: [{ role: 'user', content: 'Hello!' }]
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
          setMessage(prev => prev + event.content)
        }
      }
    }

    setStreaming(false)
  }

  return (
    <div>
      <button onClick={sendMessage} disabled={streaming}>
        Send
      </button>
      <div>{message}</div>
    </div>
  )
}
```

---

## Testing Your Setup

### Test All Providers

```typescript
const providers = ['openai', 'anthropic', 'google-ai', 'grok', 'openrouter']

async function testAllProviders() {
  for (const provider of providers) {
    try {
      const response = await fetch(`/api/provider-configs/${provider}`, {
        credentials: 'include'
      })
      const config = await response.json()

      if (config.configured && config.hasValidKey) {
        console.log(`✅ ${provider}: Configured`)
      } else {
        console.log(`⚠️  ${provider}: Not configured`)
      }
    } catch (error) {
      console.error(`❌ ${provider}: Error`, error)
    }
  }
}

testAllProviders()
```

### Verify Encryption

```bash
# Check database encryption
sqlite3 prisma/dev.db "SELECT provider, LENGTH(apiKey), apiKey LIKE 'v3:%' FROM ProviderConfig"

# Expected output:
# openai|128|1
# anthropic|142|1
```

### Load Test Rate Limiting

```typescript
async function loadTest(requests = 100) {
  const results = await Promise.allSettled(
    Array(requests).fill(null).map(() =>
      fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Test' }]
        })
      })
    )
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
  const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length

  console.log(`Succeeded: ${succeeded}`)
  console.log(`Rate limited: ${rateLimited}`)
}

loadTest(100)
```

---

## Troubleshooting

### Issue: "Provider not configured"

**Solution:**
```bash
# Check configuration
curl -X GET http://localhost:3000/api/provider-configs/openai \
  -H "Cookie: next-auth.session-token=..."

# If 404, create configuration
curl -X POST http://localhost:3000/api/provider-configs/openai \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"apiKey":"sk-proj-..."}'
```

### Issue: "Connection test failed"

**Causes:**
- Invalid API key
- Wrong base URL
- Network firewall blocking provider

**Solution:**
```typescript
// Test with cURL first
curl -X POST https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-proj-..."

// If cURL works, check application logs
tail -f logs/application.log | grep -i "test.*connection"
```

### Issue: Stream disconnects

**Solution:**
```typescript
// Increase timeout
const controller = new AbortController()
setTimeout(() => controller.abort(), 120000)  // 2 minutes

fetch('/api/llm/stream', {
  signal: controller.signal,
  ...
})
```

---

## Next Steps

1. **Explore Advanced Features**
   - Personas: Custom system prompts per conversation
   - Goals: Track completion of objectives
   - Analytics: Detailed usage insights

2. **Read Full Documentation**
   - [Provider API Documentation](./PROVIDER_API_DOCUMENTATION.md)
   - [Security Guide](./security-guide.md)
   - [Deployment Guide](./vercel-deployment.md)

3. **Optimize Performance**
   - Enable caching for repeated queries
   - Implement request deduplication
   - Configure connection pooling

4. **Monitor Production**
   - Set up alerting for rate limits
   - Track error rates per provider
   - Monitor token usage costs

---

**Need Help?**
- Check logs: `tail -f logs/application.log`
- Review errors: `/api/admin/errors`
- Test health: `/api/health`

---

**Last Updated:** 2025-01-07
