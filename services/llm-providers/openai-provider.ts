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

<<<<<<< HEAD
  constructor() {
    // Service will be initialized per request with apiKey
=======
  private getService(apiKey: string): OpenAIService {
    if (!this.service) {
      this.service = new OpenAIService(apiKey);
    }
    return this.service;
>>>>>>> origin/main
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false;
      }
      
<<<<<<< HEAD
      const service = new OpenAIService(config.apiKey);
      const result = await service.testConnection(config.apiKey);
=======
      const result = await this.getService(config.apiKey).testConnection(config.apiKey);
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
        throw new Error('API key is required');
      }
      
      const response = await this.getService(options.apiKey).chat({
        userId: options.userId || 'anonymous',
        provider: 'openai',
        messages: options.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })),
        model: options.model || this.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      }, options.apiKey);

      return {
        content: response.content,
        finishReason: response.finishReason,
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
        throw new Error('API key is required');
      }
      
      const stream = this.getService(options.apiKey).streamChat({
        userId: options.userId || 'anonymous',
        provider: 'openai',
        messages: options.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })),
        model: options.model || this.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true,
      }, options.apiKey);
>>>>>>> origin/main

      async function* convertToStringGenerator() {
        for await (const chunk of stream) {
          if (chunk.content) {
            yield chunk.content;
          }
        }
      }

      return convertToStringGenerator();
    } catch (error) {
      console.error('OpenAI streaming API error:', error);
      throw error;
    }
  }
}

export default OpenAIProvider;