// OpenRouter Provider Service
// This service handles communication with OpenRouter's various models

import { LLMProvider, Message, StreamResponse, ChatOptions } from '@/types/llm';
import { fetchWithRetry } from '@/lib/http';

class OpenRouterProvider implements LLMProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  label = 'OpenRouter';
  icon = 'Zap';
  color = 'bg-orange-500';
  description = 'Access to 100+ models from various providers';
  model = 'openrouter/auto';
  maxTokens = 8192;
  supportsStreaming = true;
  supportsSystemPrompt = true;
  maxContextLength = 32768; // Varies by model
  availableModels = [
    { 
      id: 'openrouter/auto', 
      name: 'OpenRouter Auto', 
      maxTokens: 8192,
      description: 'Automatic model routing'
    },
    { 
      id: 'openai/gpt-4o', 
      name: 'GPT-4o (OpenAI)', 
      maxTokens: 128000,
      description: 'OpenAI\'s latest model'
    },
    { 
      id: 'anthropic/claude-3.5-sonnet', 
      name: 'Claude 3.5 Sonnet (Anthropic)', 
      maxTokens: 200000,
      description: 'Anthropic\'s most capable model'
    },
    { 
      id: 'google/gemini-pro', 
      name: 'Gemini Pro (Google)', 
      maxTokens: 32768,
      description: 'Google\'s balanced model'
    },
    { 
      id: 'meta-llama/llama-3.1-70b-instruct', 
      name: 'Llama 3.1 70B (Meta)', 
      maxTokens: 128000,
      description: 'Meta\'s open-source model'
    }
  ];

  private apiKey: string | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    this.apiKey = process.env.OPENROUTER_API_KEY || null;
  }

  async validateConfig(config: { apiKey: string }): Promise<boolean> {
    try {
      if (!config.apiKey) {
        return false;
      }

      // Test API connectivity
      const response = await fetchWithRetry('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'RealMultiLLM'
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return Array.isArray(data?.data) && data.data.length > 0;
    } catch (error) {
      console.error('OpenRouter config validation error:', error);
      return false;
    }
  }

  async getModels(): Promise<any[]> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await fetchWithRetry('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'RealMultiLLM'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data?.data || this.availableModels;
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return this.availableModels;
    }
  }

  async chat(options: ChatOptions): Promise<any> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Prepare messages for OpenRouter
    const openRouterMessages = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const requestBody = {
      model,
      messages: openRouterMessages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    try {
      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'RealMultiLLM'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0]?.message?.content || '',
        finish_reason: data.choices[0]?.finish_reason || 'stop',
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw error;
    }
  }

  async streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = options.model || this.model;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Prepare messages for OpenRouter
    const openRouterMessages = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const requestBody = {
      model,
      messages: openRouterMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    };

    try {
      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'RealMultiLLM'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('OpenRouter response has no body');
      }

      async function* generator(): AsyncGenerator<string, void, undefined> {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  
                  if (content) {
                    yield content;
                  }
                  
                  if (parsed.choices[0]?.finish_reason) {
                    return;
                  }
                } catch (parseError) {
                  // Skip malformed chunks
                  continue;
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return generator();
    } catch (error) {
      console.error('OpenRouter streaming API error:', error);
      throw error;
    }
  }
}

export default OpenRouterProvider;