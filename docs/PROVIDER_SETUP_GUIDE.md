# Provider Setup & Configuration Guide

## Overview

Step-by-step guide for setting up and configuring LLM providers in RealMultiLLM, including obtaining API keys, configuring settings, and testing connections.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Provider-Specific Setup](#provider-specific-setup)
3. [Configuration Options](#configuration-options)
4. [Testing & Validation](#testing--validation)
5. [Common Issues](#common-issues)
6. [Advanced Configuration](#advanced-configuration)

---

## Quick Start

### Prerequisites

- RealMultiLLM installed and running
- User account created
- Internet connection for API calls

### Basic Setup Flow

1. **Obtain API Key** from provider
2. **Add Provider** in RealMultiLLM settings
3. **Test Connection** to validate key
4. **Configure Settings** (optional)
5. **Start Using** the provider

---

## Provider-Specific Setup

### OpenAI

#### 1. Obtain API Key

1. Visit [OpenAI Platform](https://platform.openai.com)
2. Sign in or create account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy key (starts with `sk-...`)

**Important:** Save the key immediately - you won't be able to see it again.

#### 2. Add to RealMultiLLM

**Via UI:**

1. Go to **Settings** → **Providers**
2. Select **OpenAI** from provider list
3. Paste API key
4. Click **Test Key**
5. If valid, click **Save**

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "settings": {
      "defaultModel": "gpt-4o",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "topP": 1.0,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0,
  "systemPrompt": "You are a helpful assistant."
}
```

#### 4. Available Models

| Model | Context Window | Best For | Cost |
|-------|---------------|----------|------|
| `gpt-4o` | 128K | Complex reasoning, code | $$$ |
| `gpt-4o-mini` | 128K | Fast, cost-effective | $ |
| `gpt-4-turbo` | 128K | High performance | $$$ |
| `gpt-3.5-turbo` | 16K | Simple tasks | $ |

#### 5. Pricing & Limits

- **Rate Limits:** Tier-based (check dashboard)
- **Pricing:** Pay per token
  - GPT-4o: $5.00 / 1M input, $15.00 / 1M output
  - GPT-4o-mini: $0.15 / 1M input, $0.60 / 1M output

**Monitoring Usage:**

```bash
# Via OpenAI Dashboard
https://platform.openai.com/usage

# Via RealMultiLLM Analytics
http://localhost:3000/analytics
```

---

### Anthropic (Claude)

#### 1. Obtain API Key

1. Visit [Anthropic Console](https://console.anthropic.com)
2. Sign in or request access
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy key (starts with `sk-ant-...`)

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **Anthropic Claude**
2. Enter API key
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "claude",
    "apiKey": "sk-ant-...",
    "settings": {
      "defaultModel": "claude-3-opus-20240229",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "claude-3-opus-20240229",
  "temperature": 0.7,
  "maxTokens": 4096,
  "topP": 1.0,
  "topK": 40,
  "systemPrompt": "You are Claude, a helpful AI assistant."
}
```

#### 4. Available Models

| Model | Context Window | Best For | Cost |
|-------|---------------|----------|------|
| `claude-3-opus-20240229` | 200K | Complex tasks | $$$$ |
| `claude-3-sonnet-20240229` | 200K | Balanced | $$ |
| `claude-3-haiku-20240307` | 200K | Fast, simple | $ |

#### 5. Special Features

- **Large Context:** Up to 200K tokens
- **Vision:** Image understanding (Opus & Sonnet)
- **System Instructions:** Advanced prompt engineering
- **Constitutional AI:** Built-in safety

---

### Google AI (Gemini)

#### 1. Obtain API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click **Create API Key**
4. Select or create project
5. Copy key (39 characters)

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **Google AI**
2. Enter API key
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "google-ai",
    "apiKey": "AIzaSy...",
    "settings": {
      "defaultModel": "gemini-1.5-pro",
      "temperature": 0.7,
      "maxTokens": 8192
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "gemini-1.5-pro",
  "temperature": 0.7,
  "maxTokens": 8192,
  "topP": 0.95,
  "topK": 40,
  "safetySettings": {
    "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
    "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE"
  }
}
```

#### 4. Available Models

| Model | Context Window | Best For | Cost |
|-------|---------------|----------|------|
| `gemini-1.5-pro` | 1M+ | Long context | $$ |
| `gemini-1.5-flash` | 1M+ | Fast processing | $ |
| `gemini-1.0-pro` | 32K | General use | $ |

#### 5. Special Features

- **Massive Context:** Over 1M tokens
- **Multimodal:** Text, images, video, audio
- **Free Tier:** 60 requests/minute
- **Code Execution:** Run generated code

---

### OpenRouter

#### 1. Obtain API Key

1. Visit [OpenRouter](https://openrouter.ai)
2. Sign in or create account
3. Go to **Keys** tab
4. Click **Create Key**
5. Copy key (starts with `sk-or-...`)

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **OpenRouter**
2. Enter API key
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "openrouter",
    "apiKey": "sk-or-...",
    "settings": {
      "defaultModel": "openai/gpt-4o",
      "temperature": 0.7
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "openai/gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "topP": 1.0,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0,
  "siteName": "RealMultiLLM",
  "siteUrl": "https://your-app.com"
}
```

#### 4. Available Models

OpenRouter provides access to 100+ models from multiple providers:

| Provider | Example Models |
|----------|---------------|
| OpenAI | `openai/gpt-4o`, `openai/gpt-3.5-turbo` |
| Anthropic | `anthropic/claude-3-opus`, `anthropic/claude-3-sonnet` |
| Google | `google/gemini-pro`, `google/gemini-pro-vision` |
| Meta | `meta-llama/llama-2-70b-chat`, `meta-llama/llama-3-8b` |
| Mistral | `mistralai/mistral-large`, `mistralai/mixtral-8x7b` |

View all: [OpenRouter Models](https://openrouter.ai/models)

#### 5. Special Features

- **Unified API:** Access multiple providers
- **Pay-as-you-go:** No subscriptions
- **Model Routing:** Automatic failover
- **Credits System:** Prepaid credits

---

### Hugging Face

#### 1. Obtain API Key

1. Visit [Hugging Face](https://huggingface.co)
2. Sign in or create account
3. Go to **Settings** → **Access Tokens**
4. Click **New token**
5. Select **Read** permission
6. Copy token

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **Hugging Face**
2. Enter API token
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "huggingface",
    "apiKey": "hf_...",
    "settings": {
      "defaultModel": "microsoft/DialoGPT-large"
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "microsoft/DialoGPT-large",
  "temperature": 0.7,
  "maxLength": 512,
  "topP": 0.9,
  "doSample": true,
  "useCache": true
}
```

#### 4. Popular Models

| Model | Parameters | Best For |
|-------|-----------|----------|
| `microsoft/DialoGPT-large` | 762M | Conversation |
| `EleutherAI/gpt-j-6B` | 6B | Text generation |
| `facebook/blenderbot-400M-distill` | 400M | Chatbots |
| `bigscience/bloom-560m` | 560M | Multilingual |

#### 5. Special Features

- **Free Tier:** Limited requests
- **Custom Models:** Upload your own
- **Open Source:** Community-driven
- **Inference API:** Easy deployment

---

### Cohere

#### 1. Obtain API Key

1. Visit [Cohere Dashboard](https://dashboard.cohere.ai)
2. Sign in or create account
3. Go to **API Keys** page
4. Copy or create new key
5. Key starts with no specific prefix

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **Cohere**
2. Enter API key
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "cohere",
    "apiKey": "your-api-key",
    "settings": {
      "defaultModel": "command",
      "temperature": 0.7
    }
  }'
```

#### 3. Configuration Options

```json
{
  "defaultModel": "command",
  "temperature": 0.7,
  "maxTokens": 4096,
  "k": 0,
  "p": 0.75,
  "frequencyPenalty": 0.0,
  "presencePenalty": 0.0,
  "truncate": "END"
}
```

#### 4. Available Models

| Model | Best For | Cost |
|-------|----------|------|
| `command` | Complex tasks | $$ |
| `command-light` | Simple tasks | $ |
| `command-nightly` | Latest features | $$ |

---

### Mistral AI

#### 1. Obtain API Key

1. Visit [Mistral Console](https://console.mistral.ai)
2. Sign in or create account
3. Navigate to **API Keys**
4. Click **Create new key**
5. Copy key

#### 2. Add to RealMultiLLM

**Via UI:**

1. Settings → Providers → **Mistral AI**
2. Enter API key
3. Test & Save

**Via API:**

```bash
curl -X POST http://localhost:3000/api/provider-configs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "provider": "mistral",
    "apiKey": "your-api-key",
    "settings": {
      "defaultModel": "mistral-large-latest",
      "temperature": 0.7
    }
  }'
```

#### 3. Available Models

| Model | Context | Best For |
|-------|---------|----------|
| `mistral-large-latest` | 32K | Complex reasoning |
| `mistral-medium-latest` | 32K | Balanced |
| `mistral-small-latest` | 32K | Simple tasks |
| `open-mistral-7b` | 32K | Open source |

---

## Configuration Options

### Common Settings

All providers support these base settings:

```typescript
interface ProviderSettings {
  // Model selection
  defaultModel?: string;

  // Sampling parameters
  temperature?: number;      // 0.0 - 2.0 (creativity)
  maxTokens?: number;        // Max response length
  topP?: number;            // 0.0 - 1.0 (nucleus sampling)

  // Frequency control
  frequencyPenalty?: number; // -2.0 - 2.0
  presencePenalty?: number;  // -2.0 - 2.0

  // System behavior
  systemPrompt?: string;

  // Advanced
  stopSequences?: string[];
  logitBias?: Record<string, number>;
}
```

### Provider-Specific Settings

#### OpenAI-Specific

```typescript
interface OpenAISettings extends ProviderSettings {
  // Function calling
  functions?: Array<{
    name: string;
    description: string;
    parameters: object;
  }>;
  functionCall?: 'none' | 'auto' | { name: string };

  // Response format
  responseFormat?: { type: 'text' | 'json_object' };

  // Advanced
  seed?: number;
  user?: string;
}
```

#### Claude-Specific

```typescript
interface ClaudeSettings extends ProviderSettings {
  // Sampling
  topK?: number;  // 0 - 100

  // Metadata
  metadata?: {
    userId?: string;
  };
}
```

#### Google AI-Specific

```typescript
interface GoogleAISettings extends ProviderSettings {
  // Safety
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;

  // Grounding
  groundingConfig?: {
    sources?: Array<{
      type: string;
      content: string;
    }>;
  };
}
```

---

## Testing & Validation

### Manual Testing

#### Via UI

1. Go to **Settings** → **Providers**
2. Select provider
3. Enter API key
4. Click **Test Connection**
5. Wait for validation
6. Green checkmark = success
7. Red error = invalid key

#### Via API

```bash
# Test OpenAI key
curl -X POST http://localhost:3000/api/test-api-key \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-..."
  }'

# Expected response:
{
  "valid": true,
  "message": "API key is valid"
}
```

### Automated Testing

Create a test script:

```typescript
// scripts/test-providers.ts

import { testApiKey } from '@/lib/api/provider-config-client';

const providers = [
  { name: 'openai', key: process.env.OPENAI_API_KEY },
  { name: 'claude', key: process.env.ANTHROPIC_API_KEY },
  { name: 'google-ai', key: process.env.GOOGLE_AI_API_KEY },
];

async function testAllProviders() {
  for (const provider of providers) {
    if (!provider.key) {
      console.log(`⏭️  Skipping ${provider.name} (no key)`);
      continue;
    }

    try {
      const result = await testApiKey(provider.name, provider.key);

      if (result.valid) {
        console.log(`✅ ${provider.name}: Valid`);
      } else {
        console.log(`❌ ${provider.name}: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ ${provider.name}: ${error.message}`);
    }
  }
}

testAllProviders();
```

Run:

```bash
tsx scripts/test-providers.ts
```

### Health Check Endpoint

Create health check for all providers:

```typescript
// app/api/providers/health/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserProviderConfigs } from '@/lib/api-key-service';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = await getUserProviderConfigs(session.user.id);

  const health = configs.map(config => ({
    provider: config.provider,
    configured: true,
    active: config.isActive,
    lastTested: config.updatedAt,
  }));

  return NextResponse.json({ providers: health });
}
```

---

## Common Issues

### Issue: Invalid API Key

**Symptoms:**
- "Invalid API key" error
- 401 Unauthorized response

**Solutions:**

1. **Check Key Format**
   ```typescript
   // OpenAI: sk-...
   // Claude: sk-ant-...
   // Google: 39 characters
   ```

2. **Verify on Provider Dashboard**
   - Check if key is active
   - Check usage limits
   - Regenerate if needed

3. **Test Directly**
   ```bash
   # OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-..."

   # Claude
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: sk-ant-..." \
     -H "anthropic-version: 2023-06-01" \
     -d '{"model":"claude-3-haiku-20240307","max_tokens":1,"messages":[{"role":"user","content":"Hi"}]}'
   ```

### Issue: Rate Limiting

**Symptoms:**
- 429 Too Many Requests
- "Rate limit exceeded"

**Solutions:**

1. **Check Usage Dashboard**
   - OpenAI: [platform.openai.com/usage](https://platform.openai.com/usage)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com)

2. **Upgrade Tier** (if applicable)

3. **Implement Backoff**
   ```typescript
   async function callWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error: any) {
         if (error.message.includes('rate limit') && i < maxRetries - 1) {
           await new Promise(r => setTimeout(r, 1000 * 2 ** i));
         } else {
           throw error;
         }
       }
     }
   }
   ```

4. **Use Queue System**
   - Limit concurrent requests
   - Space out requests

### Issue: Connection Timeout

**Symptoms:**
- Request hangs
- Timeout errors

**Solutions:**

1. **Increase Timeout**
   ```typescript
   fetch(url, {
     signal: AbortSignal.timeout(30000), // 30 seconds
   });
   ```

2. **Check Network**
   - VPN interference
   - Firewall blocking
   - DNS issues

3. **Use Proxy** (if needed)
   ```typescript
   const response = await fetch(url, {
     agent: new HttpsProxyAgent('http://proxy:8080'),
   });
   ```

### Issue: Model Not Available

**Symptoms:**
- "Model not found"
- 404 errors

**Solutions:**

1. **Check Model Name**
   ```typescript
   // ❌ Wrong
   model: "gpt4"

   // ✅ Correct
   model: "gpt-4o"
   ```

2. **Verify Access**
   - Some models require waitlist
   - Check account tier

3. **Update Model List**
   ```bash
   # Fetch latest models
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

---

## Advanced Configuration

### Multiple API Keys

Rotate between multiple keys:

```typescript
// lib/api-key-rotation.ts

export class ApiKeyRotator {
  private keys: string[];
  private currentIndex = 0;

  constructor(keys: string[]) {
    this.keys = keys;
  }

  getNextKey(): string {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  async callWithRotation<T>(
    fn: (apiKey: string) => Promise<T>
  ): Promise<T> {
    const key = this.getNextKey();
    return await fn(key);
  }
}

// Usage
const rotator = new ApiKeyRotator([
  process.env.OPENAI_KEY_1!,
  process.env.OPENAI_KEY_2!,
  process.env.OPENAI_KEY_3!,
]);

const response = await rotator.callWithRotation(async (key) => {
  return await openaiService.chat({ apiKey: key, ... });
});
```

### Organization-Level Keys

Share keys across team:

```prisma
model OrganizationProviderConfig {
  id            String   @id @default(cuid())
  organizationId String
  provider      String
  apiKey        String   // Encrypted
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([organizationId, provider])
}
```

### Custom Base URLs

For self-hosted or proxy endpoints:

```typescript
// Settings
{
  "provider": "openai",
  "apiKey": "sk-...",
  "settings": {
    "baseUrl": "https://your-proxy.com/v1",
    "defaultModel": "gpt-4o"
  }
}
```

### Request Interceptors

Modify requests before sending:

```typescript
// lib/request-interceptor.ts

export type RequestInterceptor = (
  request: RequestInit
) => RequestInit | Promise<RequestInit>;

export class InterceptorChain {
  private interceptors: RequestInterceptor[] = [];

  add(interceptor: RequestInterceptor) {
    this.interceptors.push(interceptor);
  }

  async apply(request: RequestInit): Promise<RequestInit> {
    let modifiedRequest = request;

    for (const interceptor of this.interceptors) {
      modifiedRequest = await interceptor(modifiedRequest);
    }

    return modifiedRequest;
  }
}

// Usage
const chain = new InterceptorChain();

// Add custom headers
chain.add((request) => ({
  ...request,
  headers: {
    ...request.headers,
    'X-Custom-Header': 'value',
  },
}));

// Add request logging
chain.add(async (request) => {
  console.log('Request:', request);
  return request;
});
```

---

## Environment-Specific Setup

### Development

```bash
# .env.local

# Encryption
API_KEY_ENCRYPTION_SEED="dev-seed-change-in-production"

# Optional: Server-side keys for testing
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AIza..."

# Database
DATABASE_URL="file:./dev.db"
```

### Production

```bash
# Set via deployment platform

# Required
API_KEY_ENCRYPTION_SEED="production-strong-random-seed"
DATABASE_URL="postgresql://..."

# Optional: Fallback keys
OPENAI_API_KEY="sk-..."
```

### Docker

```yaml
# docker-compose.yml

version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_KEY_ENCRYPTION_SEED=${API_KEY_ENCRYPTION_SEED}
      - DATABASE_URL=${DATABASE_URL}
    env_file:
      - .env.production
    secrets:
      - openai_api_key
      - anthropic_api_key

secrets:
  openai_api_key:
    file: ./secrets/openai_key.txt
  anthropic_api_key:
    file: ./secrets/anthropic_key.txt
```

---

## Backup & Recovery

### Export Configurations

```typescript
// scripts/export-configs.ts

import { getUserProviderConfigs } from '@/lib/api-key-service';
import fs from 'fs';

async function exportConfigs(userId: string) {
  const configs = await getUserProviderConfigs(userId);

  const exported = configs.map(config => ({
    provider: config.provider,
    settings: config.settings,
    // Note: API keys are NOT exported for security
  }));

  fs.writeFileSync(
    `configs-${userId}.json`,
    JSON.stringify(exported, null, 2)
  );

  console.log(`Exported ${configs.length} configurations`);
}

exportConfigs('user-id');
```

### Import Configurations

```typescript
// scripts/import-configs.ts

import { storeUserApiKey } from '@/lib/api-key-service';
import fs from 'fs';

async function importConfigs(userId: string, file: string) {
  const configs = JSON.parse(fs.readFileSync(file, 'utf8'));

  for (const config of configs) {
    // User must provide API keys manually
    const apiKey = prompt(`Enter API key for ${config.provider}:`);

    await storeUserApiKey(
      userId,
      config.provider,
      apiKey,
      config.settings
    );

    console.log(`Imported ${config.provider}`);
  }
}

importConfigs('user-id', 'configs-user-id.json');
```

---

## Security Checklist

Before going to production:

- [ ] Change `API_KEY_ENCRYPTION_SEED` from default
- [ ] Use strong encryption seed (64+ characters)
- [ ] Enable HTTPS for all API communications
- [ ] Set up rate limiting on API routes
- [ ] Configure CORS policies
- [ ] Enable audit logging
- [ ] Set up monitoring & alerts
- [ ] Review and test backup procedures
- [ ] Implement key rotation policies
- [ ] Document incident response plan
- [ ] Test disaster recovery
- [ ] Review security headers
- [ ] Enable CSP (Content Security Policy)
- [ ] Configure proper authentication
- [ ] Test with security scanner

---

## Additional Resources

### Official Documentation

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic Claude Docs](https://docs.anthropic.com)
- [Google AI Docs](https://ai.google.dev/docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Hugging Face Docs](https://huggingface.co/docs)
- [Cohere Docs](https://docs.cohere.ai)
- [Mistral Docs](https://docs.mistral.ai)

### Pricing Calculators

- [OpenAI Pricing](https://openai.com/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Google AI Pricing](https://ai.google.dev/pricing)

### Community

- [RealMultiLLM Discord](#)
- [GitHub Discussions](#)
- [Stack Overflow](#)

---

## Support

Need help? Try these resources:

1. **Check Documentation** - Start here
2. **Search Issues** - GitHub issues
3. **Ask Community** - Discord/Forums
4. **Contact Support** - For bugs/critical issues

**Reporting Issues:**

Include:
- Provider name
- Error message
- Steps to reproduce
- Environment (dev/prod)
- Logs (without API keys!)
