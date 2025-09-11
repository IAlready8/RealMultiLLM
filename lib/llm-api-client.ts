import prisma from '@/lib/prisma';
import { deriveKey, aesGcmDecrypt } from '@/lib/crypto';

// Define common types for all providers
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMStreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Retrieves and decrypts the API key for a given user and provider from the database.
 * This is a server-side only function.
 */
async function getDecryptedApiKey(userId: string, provider: string): Promise<string> {
  const providerConfig = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId: userId,
        provider: provider,
      },
    },
  });

  if (!providerConfig?.apiKey) {
    throw new Error(`API key for ${provider} not configured for this user.`);
  }

  const secret = process.env.SECURE_STORAGE_SECRET;
  if (!secret) {
    console.error('SECURE_STORAGE_SECRET is not set.');
    throw new Error('Server configuration error: Missing secret.');
  }

  try {
    const encryptionKey = await deriveKey(`${secret}:${userId}`);
    return await aesGcmDecrypt(encryptionKey, providerConfig.apiKey);
  } catch (error) {
    console.error('Failed to decrypt API key', error);
    throw new Error('Failed to process API key. Ensure it was saved correctly.');
  }
}

// Provider-specific implementation for OpenAI
async function callOpenAI(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const openaiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }));
  if (options.systemPrompt && !messages.some(m => m.role === 'system')) {
    openaiMessages.unshift({ role: 'system', content: options.systemPrompt });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: options.model || 'gpt-4o',
      messages: openaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown OpenAI error' } }));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

// Provider-specific implementation for Anthropic (Claude)
async function callClaude(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const claudeMessages = messages.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: options.model || 'claude-3-opus-20240229',
      messages: claudeMessages,
      system: options.systemPrompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown Claude error' } }));
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.content[0].text,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

// Provider-specific implementation for Google AI (Gemini)
async function callGoogleAI(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const contents = [];
  if (options.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: options.systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'I understand.' }] });
  }
  for (const msg of messages) {
    contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
  }

  const modelName = options.model || 'gemini-pro';
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens ?? 2048 },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown Google AI error' } }));
    throw new Error(error.error?.message || `Google AI API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.candidates[0].content.parts[0].text;
  const promptChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const responseChars = responseText.length;
  const estimatedPromptTokens = Math.ceil(promptChars / 4);
  const estimatedResponseTokens = Math.ceil(responseChars / 4);
  
  return {
    text: responseText,
    usage: { promptTokens: estimatedPromptTokens, completionTokens: estimatedResponseTokens, totalTokens: estimatedPromptTokens + estimatedResponseTokens },
    metadata: { provider: 'google', model: modelName },
  };
}

// Main function to call any LLM based on provider
export async function callLLM(
  userId: string,
  provider: string,
  messages: LLMMessage[],
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const apiKey = await getDecryptedApiKey(userId, provider);
  switch (provider) {
    case 'openai': return callOpenAI(messages, apiKey, options);
    case 'claude': return callClaude(messages, apiKey, options);
    case 'google': return callGoogleAI(messages, apiKey, options);
    default: throw new Error(`Unsupported provider for non-streaming: ${provider}`);
  }
}

// OpenAI streaming implementation
async function streamOpenAI(messages: LLMMessage[], apiKey: string, callbacks: LLMStreamCallbacks, options: LLMRequestOptions): Promise<void> {
  const openaiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }));
  if (options.systemPrompt && !messages.some(m => m.role === 'system')) {
    openaiMessages.unshift({ role: 'system', content: options.systemPrompt });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: options.model || 'gpt-4o', messages: openaiMessages, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 2048, stream: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown OpenAI error' } }));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream reader not available');
  const decoder = new TextDecoder('utf-8');
  let fullResponse = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
      for (const line of lines) {
        const match = line.match(/^data: (.*)$/);
        if (!match) continue;
        try {
          const data = JSON.parse(match[1]);
          const content = data.choices[0]?.delta?.content || '';
          if (content) {
            callbacks.onChunk(content);
            fullResponse += content;
          }
        } catch (e) { continue; }
      }
    }
    callbacks.onComplete?.(fullResponse);
  } finally {
    reader.releaseLock();
  }
}

// Claude streaming implementation
async function streamClaude(messages: LLMMessage[], apiKey: string, callbacks: LLMStreamCallbacks, options: LLMRequestOptions): Promise<void> {
  const claudeMessages = messages.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: options.model || 'claude-3-haiku-20240307', messages: claudeMessages, system: options.systemPrompt, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 2048, stream: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown Claude error' } }));
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream reader not available');
  const decoder = new TextDecoder('utf-8');
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
      for (const line of lines) {
        const match = line.match(/^data: (.*)$/);
        if (!match) continue;
        try {
          const data = JSON.parse(match[1]);
          if (data.type === 'content_block_delta') {
            const content = data.delta?.text || '';
            if (content) {
              callbacks.onChunk(content);
              fullResponse += content;
            }
          }
        } catch (e) { continue; }
      }
    }
    callbacks.onComplete?.(fullResponse);
  } finally {
    reader.releaseLock();
  }
}

// Function for streaming responses
export async function streamLLM(
  userId: string,
  provider: string,
  messages: LLMMessage[],
  callbacks: LLMStreamCallbacks,
  options: LLMRequestOptions = {}
): Promise<void> {
  const apiKey = await getDecryptedApiKey(userId, provider);
  options.stream = true;

  switch (provider) {
    case 'openai': return streamOpenAI(messages, apiKey, callbacks, options);
    case 'claude': return streamClaude(messages, apiKey, callbacks, options);
    default:
      const response = await callLLM(userId, provider, messages, { ...options, stream: false });
      callbacks.onChunk(response.text);
      callbacks.onComplete?.(response.text);
  }
}

// In-memory cache
const responseCache = new Map<string, { response: LLMResponse, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function callLLMWithCache(
  userId: string,
  provider: string,
  messages: LLMMessage[],
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const cacheKey = JSON.stringify({ provider, messages, options });
  const cached = responseCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.response;
  }

  const response = await callLLM(userId, provider, messages, options);
  responseCache.set(cacheKey, { response, timestamp: now });

  if (responseCache.size > 100) {
    for (const [key, value] of responseCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        responseCache.delete(key);
      }
    }
  }

  return response;
}