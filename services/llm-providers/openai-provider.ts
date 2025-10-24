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
      const result = await service.testConnection(config.apiKey);
      return result.success;
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
      if (!options.apiKey) {
        throw new Error('API key is required for chat');
      }
      const service = new OpenAIService(options.apiKey);
      const response = await service.chat({
        userId: 'anonymous',
        provider: 'openai',
        messages: options.messages,
        model: options.model || this.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      return {
        content: response.content,
        finish_reason: response.finishReason,
        usage: response.usage
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<any, void, undefined>> {
    try {
      if (!options.apiKey) {
        throw new Error('API key is required for streamChat');
      }
      const service = new OpenAIService(options.apiKey);
      const stream = service.streamChat({
        userId: 'anonymous',
        provider: 'openai',
        messages: options.messages,
        model: options.model || this.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      return stream;
    } catch (error) {
      console.error('OpenAI streaming API error:', error);
      throw error;
    }
  }
}

export default OpenAIProvider;