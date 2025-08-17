/**
 * Server-side LLM API Client - Compatible with Node.js environment
 * Uses node-fetch and server-safe APIs
 */

import { getStoredApiKey } from './secure-storage-server';
import { logger } from './logger';

// Re-export types from the main client
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

// Server-side OpenAI implementation
async function callOpenAIServer(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const openaiMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  if (options.systemPrompt && !messages.some(m => m.role === 'system')) {
    openaiMessages.unshift({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4o',
      messages: openaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
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

// Server-side Claude implementation
async function callClaudeServer(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model || 'claude-3-opus-20240229',
      messages: claudeMessages,
      system: options.systemPrompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
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

// Server-side Groq implementation
async function callGroqServer(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const groqMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  if (options.systemPrompt && !messages.some(m => m.role === 'system')) {
    groqMessages.unshift({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'llama3-8b-8192',
      messages: groqMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    text: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    metadata: {
      provider: 'groq',
      model: options.model || 'llama3-8b-8192',
    },
  };
}

// Server-side Ollama implementation
async function callOllamaServer(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  // Format messages for Ollama
  const ollamaMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  if (options.systemPrompt && !messages.some(m => m.role === 'system')) {
    ollamaMessages.unshift({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'llama3',
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  
  const responseText = data.message.content;
  const promptChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const responseChars = responseText.length;
  const estimatedPromptTokens = Math.ceil(promptChars / 4);
  const estimatedResponseTokens = Math.ceil(responseChars / 4);
  
  return {
    text: responseText,
    usage: {
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedResponseTokens,
      totalTokens: estimatedPromptTokens + estimatedResponseTokens,
    },
    metadata: {
      provider: 'ollama',
      model: options.model || 'llama3',
    },
  };
}

// Server-side Google AI implementation
async function callGoogleAIServer(
  messages: LLMMessage[],
  apiKey: string,
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  const contents = [];
  
  if (options.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: options.systemPrompt }],
    });
    
    contents.push({
      role: 'model',
      parts: [{ text: 'I understand.' }],
    });
  }
  
  for (const msg of messages) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  const modelName = options.model || 'gemini-pro';
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
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
    usage: {
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedResponseTokens,
      totalTokens: estimatedPromptTokens + estimatedResponseTokens,
    },
    metadata: {
      provider: 'google',
      model: modelName,
    },
  };
}

// Main server function
export async function callLLMServer(
  provider: string,
  messages: LLMMessage[],
  options: LLMRequestOptions = {}
): Promise<LLMResponse> {
  try {
    const apiKey = await getStoredApiKey(provider);
    if (!apiKey && provider !== 'ollama') {
      throw new Error(`No API key configured for ${provider}. Please add it in Settings.`);
    }

    switch (provider) {
      case 'openai':
        return await callOpenAIServer(messages, apiKey!, options);
      case 'claude':
        return await callClaudeServer(messages, apiKey!, options);
      case 'google':
        return await callGoogleAIServer(messages, apiKey!, options);
      case 'groq':
        return await callGroqServer(messages, apiKey!, options);
      case 'ollama':
        return await callOllamaServer(messages, apiKey || 'not-required', options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error: any) {
    logger.error(`Error calling ${provider} API:`, error);
    throw error;
  }
}