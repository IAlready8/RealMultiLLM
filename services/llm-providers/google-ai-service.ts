// Google AI (Gemini) Provider Service
// This service handles communication with Google's Gemini models

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, Message, StreamResponse, ChatOptions } from '@/types/llm';

class GoogleAIProvider implements LLMProvider {
  id = 'google-ai';
  name = 'Google AI';
  label = 'Gemini';
  icon = 'Zap';
  color = 'bg-blue-500';
  description = 'Google Gemini models';
  model = 'gemini-1.5-pro';
  maxTokens = 8192;
  supportsStreaming = true;
  supportsSystemPrompt = false; // Google AI uses safety settings instead
  maxContextLength = 1048576; // 1M tokens for Gemini 1.5
  availableModels = [
    { 
      id: 'gemini-1.5-pro', 
      name: 'Gemini 1.5 Pro', 
      maxTokens: 8192,
      description: 'Most capable model with long context'
    },
    { 
      id: 'gemini-1.5-flash', 
      name: 'Gemini 1.5 Flash', 
      maxTokens: 8192,
      description: 'Fast and efficient model'
    },
    { 
      id: 'gemini-pro', 
      name: 'Gemini Pro', 
      maxTokens: 8192,
      description: 'Balanced performance'
    }
  ];

  private client: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false;
      }

      // Test API connectivity
      const testClient = new GoogleGenerativeAI(config.apiKey);
      const model = testClient.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('Hello');
      return true;
    } catch (error) {
      console.error('Google AI config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<any[]> {
    try {
      // Return available Google AI models
      return this.availableModels;
    } catch (error) {
      console.error('Error fetching Google AI models:', error);
      return [];
    }
  }

  async chat(options: ChatOptions): Promise<any> {
    if (!this.client) {
      throw new Error('Google AI client not initialized');
    }

    const modelId = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Google AI doesn't support system prompts directly, so we'll prepend them to the first user message
    const systemMessage = options.messages.find(msg => msg.role === 'system');
    const userMessages = options.messages.filter(msg => msg.role !== 'system');

    // Convert messages to Google AI format
    const googleMessages = userMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // If there's a system message, prepend it to the first user message
    if (systemMessage && googleMessages.length > 0 && googleMessages[0].role === 'user') {
      googleMessages[0].parts.unshift({ text: `System instructions: ${systemMessage.content}\n\n` });
    }

    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
      topP: (options as any)?.topP,
      topK: (options as any)?.topK,
    };

    const safetySettings = (options as any)?.safetySettings || [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];

    const geminiModel = this.client.getGenerativeModel({
      model: modelId,
    });

    try {
      const result = await geminiModel.generateContent({
        contents: googleMessages,
      });

      const response = (result as any).response;
      
      return {
        content: (response as any).text(),
        finish_reason: (response as any).candidates?.[0]?.finishReason || 'stop',
        usage: {
          prompt_tokens: (response as any).usageMetadata?.promptTokenCount || 0,
          completion_tokens: (response as any).usageMetadata?.candidatesTokenCount || 0,
          total_tokens: (response as any).usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error) {
      console.error('Google AI API error:', error);
      throw error;
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    if (!this.client) {
      throw new Error('Google AI client not initialized');
    }

    const modelId = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Google AI doesn't support system prompts directly, so we'll prepend them to the first user message
    const systemMessage = options.messages.find(msg => msg.role === 'system');
    const userMessages = options.messages.filter(msg => msg.role !== 'system');

    // Convert messages to Google AI format
    const googleMessages = userMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // If there's a system message, prepend it to the first user message
    if (systemMessage && googleMessages.length > 0 && googleMessages[0].role === 'user') {
      googleMessages[0].parts.unshift({ text: `System instructions: ${systemMessage.content}\n\n` });
    }

    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
      topP: (options as any)?.topP,
      topK: (options as any)?.topK,
    };

    const safetySettings = (options as any)?.safetySettings || [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];

    const geminiModel = this.client.getGenerativeModel({
      model: modelId,
    });

    try {
      const result = await geminiModel.generateContentStream({
        contents: googleMessages,
      });

      async function* generator(): AsyncGenerator<string, void, undefined> {
        for await (const chunk of (result as any).stream) {
          yield (chunk as any).text();
        }
      }

      return generator();
    } catch (error) {
      console.error('Google AI streaming API error:', error);
      throw error;
    }
  }
}

export default GoogleAIProvider;