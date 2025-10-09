// Grok Provider Service
// This service handles communication with xAI's Grok models

import { LLMProvider, Message, StreamResponse, ChatOptions } from '@/types/llm';
import OpenAI from 'openai';

class GrokProvider implements LLMProvider {
  id = 'grok';
  name = 'xAI';
  label = 'Grok';
  icon = 'Zap';
  color = 'bg-black';
  description = 'xAI Grok models';
  model = 'grok-beta';
  maxTokens = 131072;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 131072; // 128K tokens for Grok
  availableModels = [
    { 
      id: 'grok-beta', 
      name: 'Grok Beta', 
      maxTokens: 131072,
      description: 'Latest Grok model'
    },
    { 
      id: 'grok-2', 
      name: 'Grok 2', 
      maxTokens: 131072,
      description: 'Previous generation Grok model'
    }
  ];

  private client: OpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.GROK_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.x.ai/v1',
      } as any);
    }
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false;
      }

      // Test API connectivity
      const testClient = new OpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://api.x.ai/v1',
      } as any);

      await testClient.models.list();
      return true;
    } catch (error) {
      console.error('Grok config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<any[]> {
    try {
      if (!this.client) {
        throw new Error('Grok client not initialized');
      }

      const models = await this.client.models.list();
      return ((models as any).data as any[]).map((model: any) => ({
        id: model.id,
        name: model.id,
        maxTokens: this.maxTokens,
        description: `xAI ${model.id} model`
      }));
    } catch (error) {
      console.error('Error fetching Grok models:', error);
      return this.availableModels;
    }
  }

  async chat(options: ChatOptions): Promise<any> {
    if (!this.client) {
      throw new Error('Grok client not initialized');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    const openAIMessages = options.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    const response = await this.client.chat.completions.create({
      model,
      messages: openAIMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const choice = (response as any).choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      finish_reason: choice?.finish_reason ?? 'stop',
      usage: (response as any).usage ?? null
    };
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    if (!this.client) {
      throw new Error('Grok client not initialized');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Convert messages to OpenAI format
    const openAIMessages = options.messages.map(msg => ({
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

    async function* generator(): AsyncGenerator<string, void, undefined> {
      for await (const chunk of stream as any) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    }

    return generator();
  }
}

export default GrokProvider;
