// lib/provider-tests.ts
import { z } from 'zod';

// Response schemas for validation
const OpenAIModelsSchema = z.object({
  object: z.literal('list'),
  data: z.array(z.object({
    id: z.string(),
    object: z.literal('model'),
    created: z.number(),
    owned_by: z.string()
  }))
});

const AnthropicMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.any()),
  model: z.string(),
  stop_reason: z.string(),
  stop_sequence: z.nullable(z.string()),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number()
  })
});

const GoogleModelsSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    version: z.string(),
    displayName: z.string(),
    description: z.string(),
    inputTokenLimit: z.number(),
    outputTokenLimit: z.number(),
    supportedGenerationMethods: z.array(z.string()),
    temperature: z.number(),
    topP: z.number(),
    topK: z.number()
  }))
});

export async function testProviderConnection(provider: string, apiKey: string): Promise<boolean> {
  try {
    switch (provider) {
      case 'openai':
        return await testOpenAIConnection(apiKey);
      case 'anthropic':
        return await testAnthropicConnection(apiKey);
      case 'google':
        return await testGoogleConnection(apiKey);
      case 'openrouter':
        return await testOpenRouterConnection(apiKey);
      case 'grok':
        return await testGrokConnection(apiKey);
      default:
        return false;
    }
  } catch (error) {
    console.error(`Failed to test ${provider} connection:`, error);
    return false;
  }
}

async function testOpenAIConnection(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) return false;

  try {
    const data = await response.json();
    const validated = OpenAIModelsSchema.parse(data);
    return validated.data.length > 0;
  } catch {
    return false;
  }
}

async function testAnthropicConnection(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    })
  });

  if (!response.ok) return false;

  try {
    const data = await response.json();
    const validated = AnthropicMessageSchema.parse(data);
    return validated.content.length > 0;
  } catch {
    return false;
  }
}

async function testGoogleConnection(apiKey: string): Promise<boolean> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) return false;

  try {
    const data = await response.json();
    const validated = GoogleModelsSchema.parse(data);
    return validated.models.length > 0;
  } catch {
    return false;
  }
}

async function testOpenRouterConnection(apiKey: string): Promise<boolean> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) return false;

  try {
    const data = await response.json();
    return Array.isArray(data.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

async function testGrokConnection(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api.x.ai/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) return false;

  try {
    const data = await response.json();
    return Array.isArray(data.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

// Get provider-specific models
export async function getProviderModels(provider: string, apiKey: string): Promise<string[]> {
  try {
    switch (provider) {
      case 'openai':
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const openaiData = await openaiResponse.json();
        return openaiData.data?.map((model: any) => model.id) || [];

      case 'anthropic':
        return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];

      case 'google':
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const googleData = await googleResponse.json();
        return googleData.models?.map((model: any) => model.name.split('/').pop()) || [];

      case 'openrouter':
        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const openrouterData = await openrouterResponse.json();
        return openrouterData.data?.map((model: any) => model.id) || [];

      case 'grok':
        const grokResponse = await fetch('https://api.x.ai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const grokData = await grokResponse.json();
        return grokData.data?.map((model: any) => model.id) || [];

      default:
        return [];
    }
  } catch (error) {
    console.error(`Failed to fetch ${provider} models:`, error);
    return [];
  }
}