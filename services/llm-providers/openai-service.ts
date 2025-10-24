/**
 * OpenAI Service
 * 
 * Enhanced OpenAI service with configuration management and error handling.
 */

import { configManager } from '@/lib/config-manager'
import { 
  errorManager, 
  LLMProviderError, 
  NetworkError, 
  ValidationError,
  createErrorContext 
} from '@/lib/error-system'
import type { ProviderConfig } from '@/lib/config-schemas'
import { ILLMProvider, ProviderMetadata, ConnectionTestResult, ModelInfo, ChatRequest, ChatChunk, ChatResponse } from './base-provider';


interface OpenAIRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  userId?: string
}

interface OpenAIResponse {
  content: string
  finish_reason: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: { content?: string; role?: string }
    finish_reason: string | null
  }>
}

class OpenAIService implements ILLMProvider {
  private baseUrl = 'https://api.openai.com/v1'
  private metadata: ProviderMetadata;

  constructor(private apiKey: string) {
    this.metadata = {
      id: 'openai',
      name: 'OpenAI',
      label: 'ChatGPT',
      icon: 'Zap',
      color: 'bg-green-500',
      description: 'OpenAI GPT models including GPT-4 and GPT-3.5',
      website: 'https://openai.com',
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextLength: 128000,
      requiresBaseUrl: false,
      rateLimitNotes: 'Tier-based rate limits (3-5K RPM standard)',
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          maxTokens: 16384,
          description: 'Most capable multimodal model',
          contextWindow: 128000,
          pricing: { input: 2.5, output: 10 }
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          maxTokens: 16384,
          description: 'Fast and cost-effective',
          contextWindow: 128000,
          pricing: { input: 0.15, output: 0.6 }
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          maxTokens: 4096,
          description: 'High-performance GPT-4',
          contextWindow: 128000,
          pricing: { input: 10, output: 30 }
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          maxTokens: 4096,
          description: 'Fast and efficient',
          contextWindow: 16385,
          pricing: { input: 0.5, output: 1.5 }
        }
      ]
    };
  }

  getMetadata(): ProviderMetadata { // Implemented getMetadata
    return this.metadata;
  }

  async testConnection(apiKey: string, baseUrl?: string): Promise<ConnectionTestResult> {
    try {
      const url = baseUrl || this.baseUrl
      const response = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Personal-LLM-Tool/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const context = createErrorContext('/services/openai/test', undefined, { 
          status: response.status,
          statusText: response.statusText 
        })
        throw new LLMProviderError(
          'openai', 
          errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`, 
          context
        )
      }

      return { success: true };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error
      }
      
      const context = createErrorContext('/services/openai/test')
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Failed to connect to OpenAI API', context, error)
      }
      
      throw new LLMProviderError('openai', (error as Error).message, context)
    }
  }

  async chat(request: ChatRequest, apiKey: string, baseUrl?: string): Promise<ChatResponse> {
    const context = createErrorContext('/services/openai/chat', request.userId, {
      model: request.model,
      messages_count: request.messages.length,
    })

    try {
<<<<<<< HEAD
      const baseUrl = this.baseUrl
=======
      const effectiveBaseUrl = baseUrl || this.baseUrl // Use provided baseUrl or default
>>>>>>> origin/main
      const model = request.model || 'gpt-3.5-turbo'

      if (!this.apiKey) { // Use this.apiKey
        throw new ValidationError('OpenAI API key not configured', 'api_key', context)
      }

      // Validate request
      if (!request.messages || request.messages.length === 0) {
        throw new ValidationError('Messages array is required and cannot be empty', 'messages', context)
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`, // Use this.apiKey
          'User-Agent': 'Personal-LLM-Tool/1.0',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: request.stream ?? false,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const errorMessage = errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`
        
        // Handle specific OpenAI error types
        if (response.status === 401) {
          throw new ValidationError('Invalid API key', 'api_key', context)
        } else if (response.status === 429) {
          throw new LLMProviderError('openai', 'Rate limit exceeded', context)
        } else if (response.status >= 500) {
          throw new LLMProviderError('openai', 'OpenAI service unavailable', context)
        } else {
          throw new LLMProviderError('openai', errorMessage, context)
        }
      }

      const data = await response.json()
      
      if (!data.choices || data.choices.length === 0) {
        throw new LLMProviderError('openai', 'No response choices returned', context)
      }

      return {
        content: data.choices[0].message?.content || '',
        finishReason: data.choices[0].finish_reason,
        usage: data.usage,
      }

    } catch (error) {
      await errorManager.logError(error as Error, context)
      throw error
    }
  }

  async *streamChat(request: ChatRequest, apiKey: string, baseUrl?: string): AsyncGenerator<ChatChunk> {
    const context = createErrorContext('/services/openai/stream', request.userId, {
      model: request.model,
      messages_count: request.messages.length,
    })

    try {
<<<<<<< HEAD
      const baseUrl = this.baseUrl
=======
      const effectiveBaseUrl = baseUrl || this.baseUrl
>>>>>>> origin/main
      const model = request.model || 'gpt-3.5-turbo'

      if (!this.apiKey) {
        throw new ValidationError('OpenAI API key not configured', 'api_key', context)
      }

      if (!request.messages || request.messages.length === 0) {
        throw new ValidationError('Messages array is required and cannot be empty', 'messages', context)
      }

      const response = await fetch(`${effectiveBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Personal-LLM-Tool/1.0',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const errorMessage = errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new LLMProviderError('openai', errorMessage, context)
      }

      if (!response.body) {
        throw new LLMProviderError('openai', 'No response body received', context)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              
              if (data === '[DONE]') {
                return
              }

              try {
                const parsed: OpenAIStreamChunk = JSON.parse(data)
                const content = parsed.choices[0]?.delta?.content
                
                if (content) {
                  yield { content } // Yield ChatChunk
                }

                if (parsed.choices[0]?.finish_reason) {
                  yield { // Yield final chunk with finishReason
                    content: '',
                    done: true,
                    finishReason: parsed.choices[0].finish_reason,
                  }
                  return
                }
              } catch (parseError) {
                // Skip malformed chunks
                continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      await errorManager.logError(error as Error, context)
      throw error
    }
  }

  async getModels(apiKey?: string): Promise<ModelInfo[]> {
    const context = createErrorContext('/services/openai/models', undefined) // userId is not always available here

    try {
      // If an API key is provided, try to fetch live models
      if (apiKey) {
        const url = this.baseUrl;
        const response = await fetch(`${url}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'User-Agent': 'Personal-LLM-Tool/1.0',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new LLMProviderError(
            'openai',
            errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`,
            context
          );
        }

        const data = await response.json();
        // Map OpenAI models to ModelInfo interface
        return data.data.map((model: any) => ({
          id: model.id,
          name: model.id, // OpenAI models often use ID as name
          maxTokens: 4096, // Default or fetch from a more detailed endpoint if available
          description: model.id,
        }));
      }
      
      // Return default models from metadata if no API key or fetch fails
      return this.metadata.models;
    } catch (error) {
      console.warn(`Failed to fetch live models for OpenAI, falling back to static list:`, error);
      await errorManager.logError(error as Error, context);
      return this.metadata.models;
    }
  }
}

// Single default export
export default OpenAIService;