// OpenAI Provider Service
// This service handles communication with OpenAI's models

import { LLMProvider, Message, ChatOptions } from '@/types/llm';
import OpenAIService from './openai-service';

class OpenAIProvider implements LLMProvider {
  id = 'openai';
  name = 'OpenAI';
  label = 'GPT';
  icon = 'Zap';
  color = 'bg-green-500';
  description = 'OpenAI GPT models';
  model = 'gpt-4o';
  maxTokens = 4096;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 128000;
  availableModels = [
    { 
      id: 'gpt-4o', 
      name: 'GPT-4o', 
      maxTokens: 4096,
      description: 'Most capable model'
    },
    { 
      id: 'gpt-4o-mini', 
      name: 'GPT-4o Mini', 
      maxTokens: 4096,
      description: 'Affordable and intelligent'
    },
    { 
      id: 'gpt-3.5-turbo', 
      name: 'GPT-3.5 Turbo', 
      maxTokens: 4096,
      description: 'Fast and efficient'
    }
  ];

  private service: OpenAIService | null = null;

  constructor() {
    // Service will be initialized per request with apiKey
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false;
      }
      
      const service = new OpenAIService(config.apiKey);
      return await service.testConnection(config.apiKey);
    } catch (error) {
      console.error('OpenAI config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<any[]> {
    try {
      return this.availableModels;
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return this.availableModels;
    }
  }

  async chat(options: ChatOptions): Promise<any> {
    try {
      const response = await this.service.chat({
        messages: options.messages,
        model: options.model || this.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false,
      });

      return {
        content: response.content,
        finish_reason: response.finish_reason,
        usage: response.usage
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    try {
      const stream = this.service.streamChat({
        messages: options.messages,
        model: options.model || this.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      });

      return stream;
    } catch (error) {
      console.error('OpenAI streaming API error:', error);
      throw error;
    }
  }
}

export default OpenAIProvider;