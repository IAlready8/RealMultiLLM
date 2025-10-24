/**
 * Chat Client Service
 * Handles non-streaming LLM chat responses
 * Provides unified interface for all supported providers
 */

import { testProviderConnectivity } from './provider-test-service';

export interface ChatOptions {
  provider: string;
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

/**
 * Create a non-streaming chat response from an LLM provider
 */
export async function createChatResponse(options: ChatOptions): Promise<ChatResponse> {
  const { provider, apiKey, messages, options: chatOptions } = options;

  // Validate API key first
  const testResult = await testProviderConnectivity(provider, apiKey);
  if (!testResult.success) {
    throw new Error(`Provider test failed: ${testResult.message}`);
  }

  switch (provider.toLowerCase()) {
    case 'openai':
      return createOpenAIChat(apiKey, messages, chatOptions);
    case 'anthropic':
      return createAnthropicChat(apiKey, messages, chatOptions);
    case 'google-ai':
    case 'google':
      return createGoogleAIChat(apiKey, messages, chatOptions);
    case 'openrouter':
      return createOpenRouterChat(apiKey, messages, chatOptions);
    case 'grok':
      return createGrokChat(apiKey, messages, chatOptions);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Create OpenAI chat response
 */
async function createOpenAIChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'gpt-4o-mini',
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage;

  return {
    content,
    usage: usage ? {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    } : undefined,
    model: data.model || options?.model || 'gpt-4o-mini',
    provider: 'openai',
  };
}

/**
 * Create Anthropic chat response
 */
async function createAnthropicChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options?.model || 'claude-3-haiku-20240307',
      messages,
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature || 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  const usage = data.usage;

  return {
    content,
    usage: usage ? {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    } : undefined,
    model: data.model || options?.model || 'claude-3-haiku-20240307',
    provider: 'anthropic',
  };
}

/**
 * Create Google AI chat response
 */
async function createGoogleAIChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResponse> {
  // Convert messages to Google AI format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${options?.model || 'gemini-pro'}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 1000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google AI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata;

  return {
    content,
    usage: usage ? {
      promptTokens: usage.promptTokenCount,
      completionTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
    } : undefined,
    model: options?.model || 'gemini-pro',
    provider: 'google-ai',
  };
}

/**
 * Create OpenRouter chat response
 */
async function createOpenRouterChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'auto',
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage;

  return {
    content,
    usage: usage ? {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    } : undefined,
    model: data.model || options?.model || 'auto',
    provider: 'openrouter',
  };
}

/**
 * Create Grok chat response
 */
async function createGrokChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<ChatResponse> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options?.model || 'grok-1',
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Grok API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage;

  return {
    content,
    usage: usage ? {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    } : undefined,
    model: data.model || options?.model || 'grok-1',
    provider: 'grok',
  };
}
