import { ILLMProvider, ProviderMetadata, ConnectionTestResult, ModelInfo } from '@/services/llm-providers/base-provider';

export class MockOpenAIProvider implements ILLMProvider {
  constructor(private apiKey: string) {}
  getMetadata(): ProviderMetadata {
    return {
      id: 'openai',
      name: 'OpenAI',
      label: 'ChatGPT',
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextLength: 128000,
      models: [{ id: 'gpt-4o', name: 'GPT-4o', maxTokens: 16384 }],
    };
  }
  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    return { success: apiKey === 'valid-openai-key', error: apiKey === 'valid-openai-key' ? undefined : 'Invalid OpenAI Key' };
  }
  async* streamChat(): AsyncGenerator<any> { yield { content: 'mock' }; }
  async chat(): Promise<any> { return { content: 'mock' }; }
  async getModels(): Promise<ModelInfo[]> { return this.getMetadata().models; }
}

export class MockAnthropicProvider implements ILLMProvider {
  constructor(private apiKey: string) {}
  getMetadata(): ProviderMetadata {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      label: 'Claude',
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextLength: 200000,
      models: [{ id: 'claude-3-haiku', name: 'Claude 3 Haiku', maxTokens: 4096 }],
    };
  }
  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    return { success: apiKey === 'valid-anthropic-key', error: apiKey === 'valid-anthropic-key' ? undefined : 'Invalid Anthropic Key' };
  }
  async* streamChat(): AsyncGenerator<any> { yield { content: 'mock' }; }
  async chat(): Promise<any> { return { content: 'mock' }; }
  async getModels(): Promise<ModelInfo[]> { return this.getMetadata().models; }
}

export class MockGoogleAIProvider implements ILLMProvider {
  constructor(apiKey: string) {}
  getMetadata(): ProviderMetadata {
    return { id: 'google-ai', name: 'Google AI', label: 'Gemini', supportsStreaming: true, supportsSystemPrompt: false, maxContextLength: 1048576, models: [] };
  }
  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    return { success: apiKey === 'valid-google-key' }; }
  async* streamChat(): AsyncGenerator<any> { yield { content: 'mock' }; }
  async chat(): Promise<any> { return { content: 'mock' }; }
  async getModels(): Promise<ModelInfo[]> { return this.getMetadata().models; }
}

export class MockGrokProvider implements ILLMProvider {
  constructor(apiKey: string) {}
  getMetadata(): ProviderMetadata {
    return { id: 'grok', name: 'xAI', label: 'Grok', supportsStreaming: true, supportsSystemPrompt: true, maxContextLength: 131072, models: [] };
  }
  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    return { success: apiKey === 'valid-grok-key' }; }
  async* streamChat(): AsyncGenerator<any> { yield { content: 'mock' }; }
  async chat(): Promise<any> { return { content: 'mock' }; }
  async getModels(): Promise<ModelInfo[]> { return this.getMetadata().models; }
}

export class MockOpenRouterProvider implements ILLMProvider {
  constructor(apiKey: string) {}
  getMetadata(): ProviderMetadata {
    return { id: 'openrouter', name: 'OpenRouter', label: 'OpenRouter', supportsStreaming: true, supportsSystemPrompt: true, maxContextLength: 200000, models: [] };
  }
  async testConnection(apiKey: string): Promise<ConnectionTestResult> {
    return { success: apiKey === 'valid-openrouter-key' }; }
  async* streamChat(): AsyncGenerator<any> { yield { content: 'mock' }; }
  async chat(): Promise<any> { return { content: 'mock' }; }
  async getModels(): Promise<ModelInfo[]> { return this.getMetadata().models; }
}
