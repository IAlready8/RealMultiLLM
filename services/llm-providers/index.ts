// Provider Registry
// This file manages all LLM providers and their configurations

import { LLMProvider } from '@/types/llm';
import OpenAIProvider from './openai-provider';
import AnthropicProvider from './anthropic-service';
import GoogleAIProvider from './google-ai-service';
import OpenRouterProvider from './openrouter-service';
import GrokProvider from './grok-service';

// Provider registry mapping provider IDs to their implementations
export const providerRegistry: Record<string, LLMProvider> = {
  'openai': new OpenAIProvider(),
  'anthropic': new AnthropicProvider(),
  'google-ai': new GoogleAIProvider(),
  'openrouter': new OpenRouterProvider(),
  'grok': new GrokProvider()
};

// Get a provider by ID
export function getProvider(providerId: string): LLMProvider | null {
  return providerRegistry[providerId] || null;
}

// Get all available providers
export function getAllProviders(): LLMProvider[] {
  return Object.values(providerRegistry);
}

// Get provider IDs
export function getProviderIds(): string[] {
  return Object.keys(providerRegistry);
}

// Validate a provider configuration
export async function validateProviderConfig(
  providerId: string,
  config: any
): Promise<boolean> {
  const provider = getProvider(providerId);
  if (!provider) {
    return false;
  }

  return await provider.validateConfig(config);
}

// Get models for a specific provider
export async function getProviderModels(providerId: string): Promise<any[]> {
  const provider = getProvider(providerId);
  if (!provider) {
    return [];
  }

  return await provider.getModels();
}

// Stream chat with a specific provider
export async function streamChatWithProvider(
  providerId: string,
  options: any
): Promise<any> {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  return await provider.streamChat(options);
}

export default providerRegistry;