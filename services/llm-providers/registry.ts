/**
 * Unified Provider Registry
 *
 * Central registry for all LLM providers with metadata, instantiation,
 * and validation. Enables dynamic provider discovery and configuration.
 */

import type { ILLMProvider, ProviderMetadata, ChatRequest, ChatChunk, ChatResponse, ModelInfo, ConnectionTestResult } from './base-provider'
import OpenAIService from './openai-service'

// Lazy-loaded provider instances (singletons per API key)
// Note: These should ideally be managed per user session or context,
// but for simplicity, we'll use a basic caching mechanism here.
const anthropicServiceCache: Record<string, ILLMProvider> = {};
const googleAIServiceCache: Record<string, ILLMProvider> = {};
const grokServiceCache: Record<string, ILLMProvider> = {};
const openRouterServiceCache: Record<string, ILLMProvider> = {};


/**
 * Provider factory pattern for singleton instances
 */
interface ProviderFactory {
  getInstance: (apiKey: string) => Promise<ILLMProvider>; // Added apiKey parameter
  metadata: ProviderMetadata;
}

/**
 * Provider metadata registry
 * Pre-configured to enable UI rendering without instantiation
 */
const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    label: 'ChatGPT',
    icon: 'Zap',
    color: 'bg-green-500',
    description: 'OpenAI GPT models including GPT-4 and GPT-3.5',
    website: 'https://openai.com',
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextLength: 128000,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        maxTokens: 16384,
        description: 'Most capable multimodal model',
        contextWindow: 128000,
        pricing: { input: 2.5, output: 10 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        maxTokens: 16384,
        description: 'Fast and cost-effective',
        contextWindow: 128000,
        pricing: { input: 0.15, output: 0.6 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        maxTokens: 4096,
        description: 'High-performance GPT-4',
        contextWindow: 128000,
        pricing: { input: 10, output: 30 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        maxTokens: 4096,
        description: 'Fast and efficient',
        contextWindow: 16385,
        pricing: { input: 0.5, output: 1.5 }
      }
    ]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    label: 'Claude',
    icon: 'Zap',
    color: 'bg-purple-500',
    description: 'Anthropic Claude models with extended context',
    website: 'https://anthropic.com',
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextLength: 200000,
    requiresBaseUrl: false,
    rateLimitNotes: '4K RPM (tier 1), higher tiers available',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        maxTokens: 8192,
        description: 'Most capable model with vision',
        contextWindow: 200000,
        pricing: { input: 3, output: 15 }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        maxTokens: 4096,
        description: 'Advanced reasoning',
        contextWindow: 200000,
        pricing: { input: 15, output: 75 }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        maxTokens: 4096,
        description: 'Balanced performance',
        contextWindow: 200000,
        pricing: { input: 3, output: 15 }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        maxTokens: 4096,
        description: 'Fastest and most compact',
        contextWindow: 200000,
        pricing: { input: 0.25, output: 1.25 }
      }
    ]
  },
  'google-ai': {
    id: 'google-ai',
    name: 'Google AI',
    label: 'Gemini',
    icon: 'Zap',
    color: 'bg-blue-500',
    description: 'Google Gemini models with 1M+ context',
    website: 'https://ai.google.dev',
    supportsStreaming: true,
    supportsSystemPrompt: false,
    maxContextLength: 1048576,
    requiresBaseUrl: false,
    rateLimitNotes: '60 RPM free tier, higher with paid',
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        maxTokens: 8192,
        description: 'Long context with multimodal',
        contextWindow: 1048576,
        pricing: { input: 1.25, output: 5 }
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        maxTokens: 8192,
        description: 'Fast and efficient',
        contextWindow: 1048576,
        pricing: { input: 0.075, output: 0.3 }
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        maxTokens: 8192,
        description: 'Balanced model',
        contextWindow: 32768,
        pricing: { input: 0.5, output: 1.5 }
      }
    ]
  },
  grok: {
    id: 'grok',
    name: 'xAI',
    label: 'Grok',
    icon: 'Zap',
    color: 'bg-black',
    description: 'xAI Grok models with extended context',
    website: 'https://x.ai',
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextLength: 131072,
    requiresBaseUrl: false,
    rateLimitNotes: 'Custom rate limits per account',
    models: [
      {
        id: 'grok-beta',
        name: 'Grok Beta',
        maxTokens: 131072,
        description: 'Latest Grok model',
        contextWindow: 131072
      },
      {
        id: 'grok-2',
        name: 'Grok 2',
        maxTokens: 131072,
        description: 'Previous generation',
        contextWindow: 131072
      }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    label: 'OpenRouter',
    icon: 'Zap',
    color: 'bg-orange-500',
    description: 'Unified access to 100+ LLM models',
    website: 'https://openrouter.ai',
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextLength: 200000,
    requiresBaseUrl: false,
    rateLimitNotes: 'Varies by model and account tier',
    models: [
      {
        id: 'openrouter/auto',
        name: 'Auto Router',
        maxTokens: 8192,
        description: 'Automatic best model routing'
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o via OpenRouter',
        maxTokens: 16384,
        description: 'OpenAI GPT-4o through OpenRouter'
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 via OpenRouter',
        maxTokens: 8192,
        description: 'Anthropic Claude through OpenRouter'
      },
      {
        id: 'google/gemini-pro',
        name: 'Gemini via OpenRouter',
        maxTokens: 8192,
        description: 'Google Gemini through OpenRouter'
      }
    ]
  }
}

/**
 * Provider factory registry
 */
const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  openai: {
    metadata: PROVIDER_METADATA.openai,
    getInstance: async (apiKey: string) => {
      return new OpenAIService(apiKey);
    }
  },
  anthropic: {
    metadata: PROVIDER_METADATA.anthropic,
    getInstance: async (apiKey: string) => {
      if (!anthropicServiceCache[apiKey]) {
        const module = await import('./anthropic-service');
        const provider = new module.default();
        anthropicServiceCache[apiKey] = provider as unknown as ILLMProvider;
      }
      return anthropicServiceCache[apiKey];
    }
  },
  'google-ai': {
    metadata: PROVIDER_METADATA['google-ai'],
    getInstance: async (apiKey: string) => {
      if (!googleAIServiceCache[apiKey]) {
        const module = await import('./google-ai-service');
        const provider = new module.default();
        googleAIServiceCache[apiKey] = provider as unknown as ILLMProvider;
      }
      return googleAIServiceCache[apiKey];
    }
  },
  grok: {
    metadata: PROVIDER_METADATA.grok,
    getInstance: async (apiKey: string) => {
      if (!grokServiceCache[apiKey]) {
        const module = await import('./grok-service');
        const provider = new module.default();
        grokServiceCache[apiKey] = provider as unknown as ILLMProvider;
      }
      return grokServiceCache[apiKey];
    }
  },
  openrouter: {
    metadata: PROVIDER_METADATA.openrouter,
    getInstance: async (apiKey: string) => {
      if (!openRouterServiceCache[apiKey]) {
        const module = await import('./openrouter-service');
        const provider = new module.default();
        openRouterServiceCache[apiKey] = provider as unknown as ILLMProvider;
      }
      return openRouterServiceCache[apiKey];
    }
  }
}

/**
 * Get provider instance by ID
 * @param providerId - Provider identifier (openai, anthropic, etc.)
 * @param apiKey - The API key for the provider
 * @returns Provider instance or null if not found
 */
export async function getProvider(providerId: string, apiKey: string): Promise<ILLMProvider | null> {
  const factory = PROVIDER_FACTORIES[providerId];
  if (!factory) {
    console.error(`Provider not found: ${providerId}`);
    return null;
  }

  try {
    return await factory.getInstance(apiKey);
  } catch (error) {
    console.error(`Failed to instantiate provider ${providerId}:`, error);
    return null;
  }
}

/**
 * Get all available provider IDs
 */
export function getProviderIds(): string[] {
  return Object.keys(PROVIDER_FACTORIES)
}

/**
 * Get provider metadata without instantiation
 * Optimized for UI rendering and configuration interfaces
 */
export function getProviderMetadata(providerId: string): ProviderMetadata | null {
  return PROVIDER_METADATA[providerId] || null
}

/**
 * Get all provider metadata
 */
export function getAllProviderMetadata(): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA)
}

/**
 * Check if provider exists
 */
export function hasProvider(providerId: string): boolean {
  return providerId in PROVIDER_FACTORIES
}

/**
 * Get models for a provider
 * @param providerId - Provider identifier
 * @param apiKey - Optional API key for dynamic model fetching
 */
export async function getProviderModels(
  providerId: string,
  apiKey?: string
): Promise<ModelInfo[]> {
  const metadata = getProviderMetadata(providerId)
  if (!metadata) {
    throw new Error(`Unknown provider: ${providerId}`)
  }

  // If API key provided, try to fetch live models
  if (apiKey) {
    try {
      const provider = await getProvider(providerId, apiKey)
      if (provider) {
        const models = await provider.getModels(apiKey)
        if (models && models.length > 0) {
          return models
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch live models for ${providerId}, falling back to static list:`, error)
    }
  }

  // Return static metadata models
  return metadata.models
}

/**
 * Test provider connection
 */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  baseUrl?: string
): Promise<ConnectionTestResult> {
  const provider = await getProvider(providerId, apiKey)
  if (!provider) {
    return {
      success: false,
      error: `Provider ${providerId} not found`
    }
  }

  try {
    return await provider.testConnection(apiKey, baseUrl)
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Connection test failed'
    }
  }
}

/**
 * Stream chat with provider
 */
export async function streamChatWithProvider(
  providerId: string,
  request: ChatRequest,
  apiKey: string,
  baseUrl?: string
): Promise<AsyncGenerator<ChatChunk>> {
  const provider = await getProvider(providerId, apiKey)
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`)
  }

  return provider.streamChat(request, apiKey, baseUrl)
}

/**
 * Non-streaming chat with provider
 */
export async function chatWithProvider(
  providerId: string,
  request: ChatRequest,
  apiKey: string,
  baseUrl?: string
): Promise<ChatResponse> {
  const provider = await getProvider(providerId, apiKey)
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`)
  }

  return provider.chat(request, apiKey, baseUrl)
}

/**
 * Validate provider configuration
 */
export async function validateProviderConfig(
  providerId: string,
  config: { apiKey: string; baseUrl?: string }
): Promise<{ valid: boolean; error?: string }> {
  if (!hasProvider(providerId)) {
    return { valid: false, error: 'Unknown provider' }
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' }
  }

  const result = await testProviderConnection(providerId, config.apiKey, config.baseUrl)

  return {
    valid: result.success,
    error: result.error
  }
}

/**
 * Provider registry class for external compatibility
 */
class ProviderRegistry {
  getAll() {
    return Object.values(PROVIDER_FACTORIES);
  }
  
  get(providerId: string) {
    // This method cannot return a fully instantiated provider without an API key.
    // It should probably return metadata only, or require an API key.
    // For now, returning null as it's not safe to instantiate without a key.
    console.warn(`Attempted to get provider instance for ${providerId} without API key. Returning null.`);
    return null;
  }
  
  has(providerId: string) {
    return providerId in PROVIDER_FACTORIES;
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistry();

// Export types for external usage
export type { ILLMProvider, ProviderMetadata, ChatRequest, ChatChunk, ChatResponse, ModelInfo, ConnectionTestResult }