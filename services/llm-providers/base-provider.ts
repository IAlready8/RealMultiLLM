/**
 * Base Provider Interface & Types
 *
 * Enterprise-grade provider abstraction layer for multi-LLM platform.
 * Enforces standardization, security, and scalability across all providers.
 */

export interface ProviderMetadata {
  id: string
  name: string
  label: string
  icon?: string
  color?: string
  description?: string
  website?: string
  models: ModelInfo[]
  supportsStreaming: boolean
  supportsSystemPrompt: boolean
  maxContextLength: number
  requiresBaseUrl?: boolean
  rateLimitNotes?: string
}

export interface ModelInfo {
  id: string
  name: string
  maxTokens: number
  description?: string
  type?: 'chat' | 'completion' | 'embedding' | 'image'
  contextWindow?: number
  pricing?: {
    input: number  // per 1M tokens
    output: number // per 1M tokens
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
  function_call?: any
}

export interface ChatRequest {
  userId: string
  provider: string
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string | string[]
  stream?: boolean
  safetySettings?: any[]
}

export interface ChatChunk {
  content: string
  done?: boolean
  finishReason?: string | null
  usage?: TokenUsage
  metadata?: Record<string, any>
}

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ChatResponse {
  content: string
  finishReason: string
  usage: TokenUsage
  metadata?: Record<string, any>
}

export interface ConnectionTestResult {
  success: boolean
  latencyMs?: number
  error?: string
  details?: Record<string, any>
}

/**
 * Base LLM Provider Interface
 *
 * All provider implementations must conform to this contract for
 * seamless integration and consistent behavior.
 */
export interface ILLMProvider {
  /**
   * Get provider metadata including available models and capabilities
   */
  getMetadata(): ProviderMetadata

  /**
   * Test connection to provider API
   * @param apiKey - Raw API key for testing
   * @param baseUrl - Optional custom base URL
   * @returns Connection test result with latency metrics
   */
  testConnection(apiKey: string, baseUrl?: string): Promise<ConnectionTestResult>

  /**
   * Stream chat completion
   * @param request - Chat request parameters
   * @param apiKey - Resolved API key (decrypted)
   * @param baseUrl - Optional custom base URL
   * @returns Async generator yielding chat chunks
   */
  streamChat(
    request: ChatRequest,
    apiKey: string,
    baseUrl?: string
  ): AsyncGenerator<ChatChunk>

  /**
   * Non-streaming chat completion
   * @param request - Chat request parameters
   * @param apiKey - Resolved API key (decrypted)
   * @param baseUrl - Optional custom base URL
   * @returns Complete chat response
   */
  chat(
    request: ChatRequest,
    apiKey: string,
    baseUrl?: string
  ): Promise<ChatResponse>

  /**
   * Get available models for this provider
   * @param apiKey - Optional API key to fetch dynamic model list
   * @returns Array of available models
   */
  getModels(apiKey?: string): Promise<ModelInfo[]>
}

/**
 * Abstract Base Provider Class
 *
 * Provides shared utility methods and default implementations
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  protected abstract metadata: ProviderMetadata

  getMetadata(): ProviderMetadata {
    return this.metadata
  }

  abstract testConnection(apiKey: string, baseUrl?: string): Promise<ConnectionTestResult>
  abstract streamChat(request: ChatRequest, apiKey: string, baseUrl?: string): AsyncGenerator<ChatChunk>
  abstract chat(request: ChatRequest, apiKey: string, baseUrl?: string): Promise<ChatResponse>
  abstract getModels(apiKey?: string): Promise<ModelInfo[]>

  /**
   * Validate API key format for provider
   */
  protected validateApiKey(apiKey: string, expectedPrefix?: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false
    }
    if (expectedPrefix && !apiKey.startsWith(expectedPrefix)) {
      return false
    }
    return apiKey.length > 10
  }

  /**
   * Create authorization header
   */
  protected createAuthHeader(apiKey: string, type: 'Bearer' | 'ApiKey' = 'Bearer'): Record<string, string> {
    switch (type) {
      case 'Bearer':
        return { 'Authorization': `Bearer ${apiKey}` }
      case 'ApiKey':
        return { 'x-api-key': apiKey }
      default:
        return {}
    }
  }

  /**
   * Parse SSE/NDJSON streaming response
   */
  protected async *parseStreamingResponse(
    response: Response,
    extractContent: (chunk: any) => string | null,
    extractDone: (chunk: any) => boolean,
    extractUsage?: (chunk: any) => TokenUsage | null
  ): AsyncGenerator<ChatChunk> {
    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue

          try {
            const data = trimmed.startsWith('data: ')
              ? trimmed.slice(6)
              : trimmed

            if (!data) continue

            const parsed = JSON.parse(data)
            const content = extractContent(parsed)
            const isDone = extractDone(parsed)

            if (content) {
              yield { content }
            }

            if (isDone) {
              const usage = extractUsage?.(parsed)
              yield {
                content: '',
                done: true,
                finishReason: parsed.choices?.[0]?.finish_reason || parsed.stop_reason || 'stop',
                usage: usage || undefined
              }
              return
            }
          } catch (parseError) {
            // Skip malformed chunks
            console.warn('Failed to parse stream chunk:', parseError)
            continue
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          const usage = extractUsage?.(parsed)
          yield {
            content: '',
            done: true,
            finishReason: 'stop',
            usage: usage || undefined
          }
        } catch {
          // Ignore final buffer parse error
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Wrap fetch with timeout and error handling
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 60000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Handle common HTTP errors
   */
  protected handleHttpError(response: Response, errorBody?: any): Error {
    const status = response.status
    const message = errorBody?.error?.message || errorBody?.message || response.statusText

    switch (status) {
      case 401:
        return new Error(`Authentication failed: ${message}`)
      case 403:
        return new Error(`Access forbidden: ${message}`)
      case 429:
        return new Error(`Rate limit exceeded: ${message}`)
      case 500:
      case 502:
      case 503:
        return new Error(`Provider service unavailable: ${message}`)
      default:
        return new Error(`API error (${status}): ${message}`)
    }
  }

  /**
   * Extract usage metadata from response
   */
  protected extractUsage(data: any): TokenUsage {
    return {
      promptTokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
      completionTokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
      totalTokens: data.usage?.total_tokens ||
        (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    }
  }
}

/**
 * Provider Error Types
 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(provider: string, message: string = 'Invalid API key') {
    super(provider, message, 'INVALID_API_KEY', 401)
    this.name = 'ProviderAuthenticationError'
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, message: string = 'Rate limit exceeded') {
    super(provider, message, 'RATE_LIMIT', 429)
    this.name = 'ProviderRateLimitError'
  }
}

export class ProviderServiceUnavailableError extends ProviderError {
  constructor(provider: string, message: string = 'Service temporarily unavailable') {
    super(provider, message, 'SERVICE_UNAVAILABLE', 503)
    this.name = 'ProviderServiceUnavailableError'
  }
}
