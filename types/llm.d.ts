// Type definitions for LLM providers

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  apiKey?: string;
  userId?: string;
}

export interface StreamResponse {
  content: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMProvider {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  model: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  maxContextLength: number;
  availableModels: Array<{
    id: string;
    name: string;
    maxTokens: number;
    description: string;
  }>;
  validateConfig(config: { apiKey: string }): Promise<boolean>;
  getModels(): Promise<any[]>;
  chat(options: ChatOptions): Promise<StreamResponse>;
  streamChat(options: ChatOptions): Promise<AsyncGenerator<string, void, undefined>>;
}