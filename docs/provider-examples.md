# Provider Implementation Examples

## Overview

This document provides practical examples of how to implement and integrate with different AI providers in the RealMultiLLM platform. Each example demonstrates the standard interface implementation and common usage patterns.

## Provider Interface Implementation

### Base Provider Interface
```typescript
import { Message, StreamResponse, ChatOptions, ModelOption } from '@/types';

export interface LLMProvider {
  id: string;
  name: string;
  label: string;
  icon: any; // Lucide icon
  color: string;
  description: string;
  model: string;
  availableModels: ModelOption[];
  maxTokens: number;
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  maxContextLength: number;
  
  validateConfig(config: ProviderConfig): Promise<boolean>;
  getModels(): Promise<ModelOption[]>;
  streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse>;
}
```

## Complete Provider Implementations

### 1. OpenAI Provider Implementation

```typescript
import OpenAI from 'openai';
import { LLMProvider, Message, StreamResponse, ChatOptions, ModelOption } from '@/types';

interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class OpenAIProvider implements LLMProvider {
  id = 'openai';
  name = 'OpenAI';
  label = 'OpenAI';
  icon = 'bot'; // Lucide icon name
  color = 'bg-green-500';
  description = 'OpenAI GPT models';
  model = 'gpt-4o';
  availableModels: ModelOption[] = [];
  maxTokens = 128000;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 128000;

  private client: OpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async validateConfig(config: OpenAIConfig): Promise<boolean> {
    try {
      if (!config.apiKey || !config.apiKey.startsWith('sk-')) {
        return false;
      }

      // Test API connectivity
      const testClient = new OpenAI({ apiKey: config.apiKey });
      await testClient.models.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('OpenAI config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<ModelOption[]> {
    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }

      // Get available models from OpenAI API
      const models = await this.client.models.list();
      const openAIModels = [
        'gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18',
        'gpt-4-turbo', 'gpt-4-turbo-2024-04-09', 'gpt-4', 'gpt-3.5-turbo'
      ];

      return models.data
        .filter(model => openAIModels.includes(model.id))
        .map(model => ({
          id: model.id,
          name: model.id,
          maxTokens: this.getMaxTokensForModel(model.id),
          description: `OpenAI ${model.id} model`,
          pricing: this.getPricingForModel(model.id)
        }));
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      
      // Return default models as fallback
      return [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          maxTokens: 128000,
          description: 'Most capable model',
          pricing: { input: 0.005, output: 0.015 }
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          maxTokens: 128000,
          description: 'Cost-effective model',
          pricing: { input: 0.00015, output: 0.0006 }
        }
      ];
    }
  }

  async streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const model = options?.model || this.model;
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens || this.maxTokens;

    // Convert messages to OpenAI format
    const openAIMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    const stream = await this.client.chat.completions.create({
      model,
      messages: openAIMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    return {
      stream,
      provider: this.id,
      model,
      usage: null // Will be populated after completion
    };
  }

  private getMaxTokensForModel(model: string): number {
    switch (model) {
      case 'gpt-4o':
      case 'gpt-4o-2024-08-06':
      case 'gpt-4-turbo':
      case 'gpt-4-turbo-2024-04-09':
        return 128000;
      case 'gpt-4':
        return 8192;
      case 'gpt-4o-mini':
      case 'gpt-4o-mini-2024-07-18':
        return 128000;
      case 'gpt-3.5-turbo':
        return 16385;
      default:
        return 4096;
    }
  }

  private getPricingForModel(model: string) {
    switch (model) {
      case 'gpt-4o':
        return { input: 0.005, output: 0.015 }; // per 1K tokens
      case 'gpt-4o-mini':
        return { input: 0.00015, output: 0.0006 };
      case 'gpt-4-turbo':
        return { input: 0.01, output: 0.03 };
      case 'gpt-3.5-turbo':
        return { input: 0.0005, output: 0.0015 };
      default:
        return { input: 0.005, output: 0.015 };
    }
  }
}

export default OpenAIProvider;
```

### 2. Anthropic (Claude) Provider Implementation

```typescript
import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, Message, StreamResponse, ChatOptions, ModelOption } from '@/types';

interface AnthropicConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class AnthropicProvider implements LLMProvider {
  id = 'anthropic';
  name = 'Anthropic';
  label = 'Anthropic';
  icon = 'zap';
  color = 'bg-purple-500';
  description = 'Anthropic Claude models';
  model = 'claude-3-5-sonnet-20241022';
  availableModels: ModelOption[] = [];
  maxTokens = 4096;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 200000;

  private client: Anthropic | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async validateConfig(config: AnthropicConfig): Promise<boolean> {
    try {
      if (!config.apiKey || !config.apiKey.startsWith('sk-ant-')) {
        return false;
      }

      // Test API connectivity with a simple request
      const testClient = new Anthropic({ apiKey: config.apiKey });
      await testClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      return true;
    } catch (error) {
      console.error('Anthropic config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<ModelOption[]> {
    try {
      // Return available Claude models
      return [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          maxTokens: 8192,
          description: 'Most capable model',
          pricing: { input: 0.003, output: 0.015 }
        },
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          maxTokens: 4096,
          description: 'High-level reasoning',
          pricing: { input: 0.015, output: 0.075 }
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          maxTokens: 4096,
          description: 'Balanced performance',
          pricing: { input: 0.003, output: 0.015 }
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          maxTokens: 4096,
          description: 'Fastest model',
          pricing: { input: 0.00025, output: 0.00125 }
        }
      ];
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      
      // Return default models as fallback
      return [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          maxTokens: 8192,
          description: 'Most capable model',
          pricing: { input: 0.003, output: 0.015 }
        }
      ];
    }
  }

  async streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const model = options?.model || this.model;
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens || this.maxTokens;

    // Separate system prompt from other messages
    const systemMessage = messages.find(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');

    // Convert messages to Anthropic format
    const anthropicMessages = otherMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    const params: any = {
      model,
      messages: anthropicMessages,
      max_tokens: maxTokens,
      temperature,
    };

    if (systemMessage) {
      params.system = systemMessage.content;
    }

    const stream = await this.client.messages.create(params);

    return {
      stream,
      provider: this.id,
      model,
      usage: {
        inputTokens: stream.usage?.input_tokens || 0,
        outputTokens: stream.usage?.output_tokens || 0
      }
    };
  }
}

export default AnthropicProvider;
```

### 3. Google AI (Gemini) Provider Implementation

```typescript
import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { LLMProvider, Message, StreamResponse, ChatOptions, ModelOption } from '@/types';

interface GoogleAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class GoogleAIProvider implements LLMProvider {
  id = 'google-ai';
  name = 'Google AI';
  label = 'Google AI';
  icon = 'zap';
  color = 'bg-blue-500';
  description = 'Google Gemini models';
  model = 'gemini-1.5-pro';
  availableModels: ModelOption[] = [];
  maxTokens = 8192;
  supportsStreaming = true;
  supportsSystemPrompt = false; // Google AI uses safety settings instead
  maxContextLength = 1048576; // 1M tokens for Gemini 1.5

  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async validateConfig(config: GoogleAIConfig): Promise<boolean> {
    try {
      if (!config.apiKey || config.apiKey.length < 30) { // Basic validation
        return false;
      }

      // Test API connectivity
      const testGenAI = new GoogleGenerativeAI(config.apiKey);
      const model = testGenAI.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('Hello');
      return true;
    } catch (error) {
      console.error('Google AI config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<ModelOption[]> {
    try {
      // Return available Google AI models
      // Note: Google AI API doesn't have a direct list models endpoint
      // so we return known models
      return [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          maxTokens: 8192,
          description: 'Most capable model with long context',
          pricing: { input: 0.0035, output: 0.0105 }
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          maxTokens: 8192,
          description: 'Fast and efficient model',
          pricing: { input: 0.0007, output: 0.0021 }
        },
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          maxTokens: 8192,
          description: 'Balanced performance',
          pricing: { input: 0.000125, output: 0.000375 }
        }
      ];
    } catch (error) {
      console.error('Error getting Google AI models:', error);
      
      // Return default models as fallback
      return [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          maxTokens: 8192,
          description: 'Most capable model',
          pricing: { input: 0.0035, output: 0.0105 }
        }
      ];
    }
  }

  async streamChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<StreamResponse> {
    if (!this.genAI) {
      throw new Error('Google AI client not initialized');
    }

    const model = options?.model || this.model;
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens || this.maxTokens;

    const generationConfig: GenerationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
      topP: options?.topP,
      topK: options?.topK,
    };

    const safetySettings = options?.safetySettings || [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];

    const geminiModel = this.genAI.getGenerativeModel({
      model,
      generationConfig,
      safetySettings
    });

    // Convert messages to Google AI format
    // Google AI expects alternating user/assistant messages
    const history = messages
      .filter(msg => msg.role !== 'system') // System prompts not supported
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }));

    const chat = geminiModel.startChat({
      history,
      generationConfig,
      safetySettings
    });

    const result = await chat.sendMessageStream('');
    
    return {
      stream: result.stream,
      provider: this.id,
      model,
      usage: null // Google AI doesn't provide token usage in stream
    };
  }
}

export default GoogleAIProvider;
```

## Usage Examples

### 1. Basic Provider Usage

```typescript
import OpenAIProvider from '@/services/llm-providers/openai';
import AnthropicProvider from '@/services/llm-providers/anthropic';

// Initialize providers
const openaiProvider = new OpenAIProvider();
const anthropicProvider = new AnthropicProvider();

// Use with messages
const messages = [
  { role: 'system', content: 'You are a helpful assistant' },
  { role: 'user', content: 'Hello, how are you?' }
];

// Stream chat with OpenAI
const openaiStream = await openaiProvider.streamChat(messages, {
  model: 'gpt-4o',
  temperature: 0.7
});

// Process the stream
for await (const chunk of openaiStream.stream) {
  console.log(chunk.choices[0]?.delta?.content || '');
}
```

### 2. Multi-Provider Comparison

```typescript
import { compareProviders } from '@/services/llm-service';

async function compareProviderResponses() {
  const messages = [
    { role: 'user', content: 'Explain quantum computing in simple terms' }
  ];
  
  const providersToCompare = ['openai', 'anthropic', 'google'];
  
  try {
    const comparison = await compareProviders(providersToCompare, messages, {
      model: 'gpt-4o', // Will use this model or default for each provider
      temperature: 0.7
    });
    
    // comparison.responses contains responses from each provider
    comparison.responses.forEach(response => {
      console.log(`${response.provider}: ${response.response}`);
      console.log(`Tokens used: ${response.tokensUsed}`);
      console.log(`Response time: ${response.responseTime}ms`);
    });
  } catch (error) {
    console.error('Comparison failed:', error);
  }
}
```

### 3. Provider Validation

```typescript
import { validateProviderConfig } from '@/services/llm-service';

async function validateApiKey(providerId: string, apiKey: string) {
  try {
    const isValid = await validateProviderConfig(providerId, { apiKey });
    if (isValid) {
      console.log(`API key for ${providerId} is valid`);
      // Proceed to save the key
    } else {
      console.log(`API key for ${providerId} is invalid`);
    }
  } catch (error) {
    console.error(`Validation failed for ${providerId}:`, error);
  }
}
```

### 4. Dynamic Provider Loading

```typescript
// Provider registry pattern
class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  
  register(provider: LLMProvider) {
    this.providers.set(provider.id, provider);
  }
  
  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }
  
  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
  
  getAvailable(): { id: string; name: string; }[] {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name
    }));
  }
}

// Initialize registry
const providerRegistry = new ProviderRegistry();
providerRegistry.register(new OpenAIProvider());
providerRegistry.register(new AnthropicProvider());
providerRegistry.register(new GoogleAIProvider());

// Use in API route
export async function POST(request: Request) {
  const { provider: providerId, messages, options } = await request.json();
  
  const provider = providerRegistry.get(providerId);
  if (!provider) {
    return new Response(JSON.stringify({ error: 'Provider not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const streamResponse = await provider.streamChat(messages, options);
    
    // Process and return stream
    return new Response(streamResponse.stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Error Handling and Validation

### 1. Standardized Error Responses

```typescript
// Error handling utility
export class ProviderError extends Error {
  public provider: string;
  public code: string;
  public details?: any;
  
  constructor(provider: string, message: string, code: string, details?: any) {
    super(message);
    this.provider = provider;
    this.code = code;
    this.details = details;
    this.name = 'ProviderError';
  }
}

// Usage in provider implementation
async function validateConfig(config: any) {
  try {
    // ... validation logic
  } catch (error) {
    throw new ProviderError(
      'openai',
      'API key validation failed',
      'INVALID_API_KEY',
      { originalError: error }
    );
  }
}
```

### 2. Environment Validation

```typescript
// Validate required environment variables
export function validateEnvironment() {
  const required = [
    'ENCRYPTION_MASTER_KEY',
    'NEXTAUTH_SECRET',
    'DATABASE_URL'
  ];
  
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate encryption key format
  const encryptionKey = process.env.ENCRYPTION_MASTER_KEY;
  if (encryptionKey && !/^[0-9a-f]{128}$/.test(encryptionKey)) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string (512 bits)');
  }
  
  // Validate NextAuth secret
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (nextAuthSecret && nextAuthSecret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters long');
  }
}

// Run validation on startup
validateEnvironment();
```

## Testing Providers

### 1. Unit Tests

```typescript
// __tests__/providers/openai.test.ts
import OpenAIProvider from '@/services/llm-providers/openai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  
  beforeEach(() => {
    provider = new OpenAIProvider();
  });
  
  test('should have correct properties', () => {
    expect(provider.id).toBe('openai');
    expect(provider.name).toBe('OpenAI');
    expect(provider.supportsStreaming).toBe(true);
  });
  
  test('should validate valid API key', async () => {
    const isValid = await provider.validateConfig({
      apiKey: process.env.OPENAI_API_KEY || 'test-key'
    });
    expect(typeof isValid).toBe('boolean');
  });
  
  test('should return available models', async () => {
    const models = await provider.getModels();
    expect(Array.isArray(models)).toBe(true);
    if (models.length > 0) {
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('maxTokens');
    }
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/integration/api.test.ts
import { test, expect, describe } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('API Integration', () => {
  test('should return provider list', async () => {
    // This would test the actual API endpoint
    const response = await fetch('/api/llm/providers');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
  });
  
  test('should validate API keys', async () => {
    const response = await fetch('/api/settings/api-keys/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

## Performance Optimization

### 1. Provider Caching

```typescript
// Cache provider models to reduce API calls
const providerModelCache = new Map<string, { data: ModelOption[], timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getCachedModels(providerId: string, provider: LLMProvider) {
  const cacheKey = `${providerId}-models`;
  const cached = providerModelCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const models = await provider.getModels();
  providerModelCache.set(cacheKey, { data: models, timestamp: Date.now() });
  
  return models;
}
```

### 2. Connection Pooling

```typescript
// Maintain clients for providers
class ClientManager {
  private clients: Map<string, any> = new Map();
  private providerClasses: Map<string, any> = new Map();
  
  registerProvider(id: string, providerClass: any) {
    this.providerClasses.set(id, providerClass);
  }
  
  getClient(providerId: string) {
    if (!this.clients.has(providerId)) {
      const ProviderClass = this.providerClasses.get(providerId);
      if (ProviderClass) {
        this.clients.set(providerId, new ProviderClass());
      }
    }
    return this.clients.get(providerId);
  }
}

const clientManager = new ClientManager();
clientManager.registerProvider('openai', OpenAIProvider);
clientManager.registerProvider('anthropic', AnthropicProvider);
```

## Security Considerations

### 1. API Key Encryption

```typescript
// Encryption utilities
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 2. Rate Limiting

```typescript
// Rate limiter implementation
export class RateLimiter {
  private requests: Map<string, { count: number, resetTime: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;
  
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  checkLimit(identifier: string): { allowed: boolean, retryAfter?: number } {
    const now = Date.now();
    const requestInfo = this.requests.get(identifier);
    
    if (!requestInfo || now > requestInfo.resetTime) {
      // New window, reset counter
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true };
    }
    
    if (requestInfo.count >= this.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        retryAfter: requestInfo.resetTime - now
      };
    }
    
    // Increment counter
    requestInfo.count++;
    return { allowed: true };
  }
}

const globalRateLimiter = new RateLimiter(1000, 60000); // 1000 requests per minute
```

These examples provide a comprehensive foundation for implementing and using LLM providers in the RealMultiLLM platform. Each provider follows the same interface for consistency while implementing provider-specific logic.