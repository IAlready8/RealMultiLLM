import {
  errorManager,
  LLMProviderError,
  createErrorContext,
  ValidationError,
} from '@/lib/error-system'

import OpenAIService from './llm-providers/openai-service'
<<<<<<< HEAD
=======
import OpenAIProvider from './llm-providers/openai-provider'
>>>>>>> origin/main
import AnthropicProvider from './llm-providers/anthropic-service'
import GoogleAIProvider from './llm-providers/google-ai-service'
import OpenRouterProvider from './llm-providers/openrouter-service'
import GrokProvider from './llm-providers/grok-service'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  metadata?: Record<string, any>
}

export interface StreamChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  userId?: string
  abortSignal?: AbortSignal
  apiKey?: string
}

const providerServices = {
<<<<<<< HEAD
  openai: (apiKey?: string) => new OpenAIService(apiKey || ''),
  anthropic: (apiKey?: string) => new AnthropicProvider(),
  'google-ai': (apiKey?: string) => new GoogleAIProvider(),
  openrouter: (apiKey?: string) => new OpenRouterProvider(),
  grok: (apiKey?: string) => new GrokProvider(),
=======
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  'google-ai': () => new GoogleAIProvider(),
  openrouter: () => new OpenRouterProvider(),
  grok: () => new GrokProvider(),
>>>>>>> origin/main
}

export async function sendChatMessage(
  provider: string,
  messages: ChatMessage[],
  options: StreamChatOptions = {},
): Promise<ChatMessage> {
  const context = createErrorContext('/services/api-service', options.userId, {
    provider,
    action: 'send_chat',
    messages_count: messages.length,
  })

  try {
    if (!provider || typeof provider !== 'string') {
      throw new ValidationError('Provider is required and must be a string', 'provider', context)
    }

    if (!(provider in providerServices)) {
      throw new ValidationError(`Unsupported provider: ${provider}`, 'provider', context)
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('Messages array is required and cannot be empty', 'messages', context)
    }

    const service = providerServices[provider as keyof typeof providerServices](options.apiKey)

    const providerMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const response = await service.chat({
      messages: providerMessages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
<<<<<<< HEAD
      userId: options.userId || 'anonymous',
      provider: provider,
=======
      apiKey: options.apiKey,
>>>>>>> origin/main
    })

    return {
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
      metadata: {
        provider,
        model: options.model,
        finishReason: response.finish_reason,
        usage: response.usage,
      },
    }
  } catch (error) {
    await errorManager.logError(error as Error, context)
    throw error
  }
}

export async function streamChatMessage(
  provider: string,
  messages: ChatMessage[],
  onChunk: (chunk: string | any) => void,
  options: StreamChatOptions = {},
): Promise<void> {
  const context = createErrorContext('/services/api-service/stream', options.userId, {
    provider,
    action: 'stream_chat',
    messages_count: messages.length,
  })

  try {
    if (!provider || typeof provider !== 'string') {
      throw new ValidationError('Provider is required and must be a string', 'provider', context)
    }

    if (!(provider in providerServices)) {
      throw new ValidationError(`Unsupported provider: ${provider}`, 'provider', context)
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError('Messages array is required and cannot be empty', 'messages', context)
    }

    if (typeof onChunk !== 'function') {
      throw new ValidationError('onChunk must be a function', 'onChunk', context)
    }

    const service = providerServices[provider as keyof typeof providerServices](options.apiKey)

    const providerMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    if (options.abortSignal?.aborted) {
      throw new LLMProviderError(provider, 'Request was aborted', context)
    }

    const streamResult = await service.streamChat({
      messages: providerMessages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
<<<<<<< HEAD
      userId: options.userId || 'anonymous',
      provider: provider,
=======
      apiKey: options.apiKey,
>>>>>>> origin/main
    })

    for await (const chunk of streamResult) {
      if (options.abortSignal?.aborted) {
        throw new LLMProviderError(provider, 'Request was aborted during streaming', context)
      }

      if (chunk) {
        onChunk(chunk)
      }
    }
  } catch (error) {
    await errorManager.logError(error as Error, context)

    try {
      if (error instanceof Error) {
        onChunk(`Error: ${error.message}`)
      } else {
        onChunk('Error: An unexpected error occurred')
      }
    } catch (chunkError) {
      console.error('Failed to send error chunk:', chunkError)
    }

    throw error
  }
}

export async function callLLMApi(
  provider: string,
  prompt: string[],
  options: any = {},
): Promise<any> {
  const messages: ChatMessage[] = prompt.map((p, index) => ({
    role: index === 0 && options.systemPrompt ? 'system' : 'user',
    content: index === 0 && options.systemPrompt ? options.systemPrompt : p,
  }))

  if (options.stream && typeof options.onChunk === 'function') {
    await streamChatMessage(provider, messages, options.onChunk, options)
    return { text: '', usage: {}, metadata: {} }
  }

  const response = await sendChatMessage(provider, messages, options)
  return {
    text: response.content,
    usage: response.metadata?.usage ?? {},
    metadata: response.metadata ?? {},
  }
}
