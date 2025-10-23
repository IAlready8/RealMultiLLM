// Anthropic Provider Service
// Lightweight wrapper around the Anthropic SDK that aligns with the shared LLMProvider contract.

import Anthropic from '@anthropic-ai/sdk'

import type { LLMProvider, Message, ChatOptions, StreamResponse } from '@/types/llm'

type AnthropicRole = 'user' | 'assistant'

class AnthropicProvider implements LLMProvider {
  id = 'anthropic'
  name = 'Anthropic'
  label = 'Claude'
  icon = 'Zap'
  color = 'bg-purple-500'
  description = 'Anthropic Claude models'
  model = 'claude-3-haiku-20240307'
  maxTokens = 4096
  supportsStreaming = true
  supportsSystemPrompt = true
  maxContextLength = 200000
  availableModels = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      maxTokens: 8192,
      description: 'Most capable model',
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      maxTokens: 4096,
      description: 'Advanced reasoning',
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      maxTokens: 4096,
      description: 'Balanced performance',
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      maxTokens: 4096,
      description: 'Fastest model',
    },
  ]

  private client: Anthropic | null = null

  constructor() {
    this.initializeClient()
  }

  private initializeClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      this.client = null
      return
    }

    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  }

  private getClient(overrideKey?: string): Anthropic {
    if (overrideKey) {
      return new Anthropic({
        apiKey: overrideKey,
        dangerouslyAllowBrowser: true,
      })
    }

    if (!this.client) {
      throw new Error('Anthropic API key is not configured')
    }

    return this.client
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false
      }

      const client = this.getClient(config.apiKey)

      await client.models.list({ limit: 1 })
      return true
    } catch (error) {
      console.error('Anthropic config validation error:', error)
      return false
    }
  }

  async getModels(): Promise<any[]> {
    try {
      const client = this.getClient()
      const models = await client.models.list({ limit: 20 })
      const items = Array.isArray(models) ? models : (models as any).data ?? []

      return items
        .filter((model: any) => typeof model?.id === 'string' && model.id.startsWith('claude'))
        .map((model: any) => ({
          id: model.id,
          name: model.id.replace('claude-', 'Claude ').replace(/-/g, ' '),
          maxTokens: this.getMaxTokens(model.id),
          description: `Anthropic ${model.id}`,
        }))
    } catch (error) {
      console.warn('Falling back to static Anthropic model list:', error)
      return this.availableModels
    }
  }

  async chat(options: ChatOptions): Promise<StreamResponse> {
    const client = this.getClient()
    const messages = this.buildMessages(options.messages)

    try {
      const response = await client.messages.create({
        model: options.model || this.model,
        max_tokens: options.maxTokens ?? this.maxTokens,
        temperature: options.temperature ?? 0.7,
        messages,
        system: this.getSystemPrompt(options.messages),
      })

      const firstContent = response.content?.[0]
      const text = typeof firstContent === 'object' && 'text' in firstContent ? firstContent.text : ''

      return {
        content: text,
        finish_reason: response.stop_reason ?? 'stop',
        usage: {
          prompt_tokens: response.usage?.input_tokens ?? 0,
          completion_tokens: response.usage?.output_tokens ?? 0,
          total_tokens:
            (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        },
      }
    } catch (error) {
      console.error('Anthropic chat error:', error)
      throw error
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    const client = this.getClient()
    const messages = this.buildMessages(options.messages)
    const systemPrompt = this.getSystemPrompt(options.messages)

    const stream = await client.messages.stream({
      model: options.model || this.model,
      max_tokens: options.maxTokens ?? this.maxTokens,
      temperature: options.temperature ?? 0.7,
      messages,
      system: systemPrompt,
    })

    async function* iterator(): AsyncGenerator<string, void, undefined> {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          yield chunk.delta.text ?? ''
        }
      }
    }

    return iterator()
  }

  private buildMessages(messages: Message[]) {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as AnthropicRole,
        content: msg.content,
      }))
  }

  private getSystemPrompt(messages: Message[]): string | undefined {
    const systemMessage = messages.find((msg) => msg.role === 'system')
    return systemMessage?.content
  }

  private getMaxTokens(model: string): number {
    return this.availableModels.find((item) => item.id === model)?.maxTokens ?? this.maxTokens
  }
}

export default AnthropicProvider
