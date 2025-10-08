// Anthropic (Claude) Provider Service
// This service handles communication with Anthropic's Claude models

import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, Message, StreamResponse, ChatOptions } from '@/types';

class AnthropicProvider implements LLMProvider {
  id = 'anthropic';
  name = 'Anthropic';
  label = 'Claude';
  icon = 'Zap';
  color = 'bg-purple-500';
  description = 'Anthropic Claude models';
  model = 'claude-3-5-sonnet-20241022';
  maxTokens = 8192;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 200000;
  availableModels = [
    { 
      id: 'claude-3-5-sonnet-20241022', 
      name: 'Claude 3.5 Sonnet', 
      maxTokens: 8192,
      description: 'Most capable model'
    },
    { 
      id: 'claude-3-opus-20240229', 
      name: 'Claude 3 Opus', 
      maxTokens: 4096,
      description: 'High-level reasoning'
    },
    { 
      id: 'claude-3-sonnet-20240229', 
      name: 'Claude 3 Sonnet', 
      maxTokens: 4096,
      description: 'Balanced performance'
    },
    { 
      id: 'claude-3-haiku-20240307', 
      name: 'Claude 3 Haiku', 
      maxTokens: 4096,
      description: 'Fastest model'
    }
  ];

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

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey || !config.apiKey.startsWith('sk-ant-')) {
        return false;
      }

      // Test API connectivity
      const testClient = new Anthropic({ apiKey: config.apiKey });
      await testClient.models.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Anthropic config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<any[]> {
    try {
      if (!this.client) {
        throw new Error('Anthropic client not initialized');
      }

      // Get available models from Anthropic API
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.startsWith('claude'))
        .map(model => ({
          id: model.id,
          name: model.id.replace('claude-', 'Claude ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          maxTokens: this.getMaxTokensForModel(model.id),
          description: `Anthropic ${model.id} model`
        }));
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      
      // Return default models as fallback
      return this.availableModels;
    }
  }

  private getMaxTokensForModel(model: string): number {
    switch (model) {
      case 'claude-3-5-sonnet-20241022':
        return 8192;
      case 'claude-3-opus-20240229':
        return 4096;
      case 'claude-3-sonnet-20240229':
        return 4096;
      case 'claude-3-haiku-20240307':
        return 4096;
      default:
        return 4096;
    }
  }

  async chat(options: ChatOptions): Promise<any> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Separate system prompt from other messages
    const systemMessage = options.messages.find(msg => msg.role === 'system');
    const otherMessages = options.messages.filter(msg => msg.role !== 'system');

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

    try {
      const response = await this.client.messages.create(params);
      
      return {
        content: response.content[0].text,
        finish_reason: response.stop_reason,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Separate system prompt from other messages
    const systemMessage = options.messages.find(msg => msg.role === 'system');
    const otherMessages = options.messages.filter(msg => msg.role !== 'system');

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
      stream: true
    };

    if (systemMessage) {
      params.system = systemMessage.content;
    }

    try {
      const stream = await this.client.messages.create(params);
      
      async function* generator(): AsyncGenerator<string, void, undefined> {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            yield chunk.delta.text;
          }
        }
      }

      return generator();
    } catch (error) {
      console.error('Anthropic streaming API error:', error);
      throw error;
    }
  }
}

export default AnthropicProvider;