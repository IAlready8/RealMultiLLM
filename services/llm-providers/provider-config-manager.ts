// Provider Configuration Manager
// This service handles the validation and management of LLM provider configurations

import { getProvider } from './index';

// Validate API key for a specific provider
export async function validateApiKey(
  providerId: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get the provider
    const provider = getProvider(providerId);
    if (!provider) {
      return { valid: false, error: `Provider ${providerId} not found` };
    }

    // Validate the API key
    const isValid = await provider.validateConfig({ apiKey });
    
    if (!isValid) {
      return { valid: false, error: `Invalid API key for ${providerId}` };
    }

    return { valid: true };
  } catch (error: any) {
    console.error(`Error validating API key for ${providerId}:`, error);
    return { 
      valid: false, 
      error: error.message || `Failed to validate API key for ${providerId}` 
    };
  }
}

// Test provider connectivity
export async function testProviderConnectivity(
  providerId: string,
  apiKey: string
): Promise<{ connected: boolean; error?: string }> {
  try {
    // Validate API key first
    const validation = await validateApiKey(providerId, apiKey);
    if (!validation.valid) {
      return { connected: false, error: validation.error };
    }

    // Test basic connectivity by fetching models
    const provider = getProvider(providerId);
    if (!provider) {
      return { connected: false, error: `Provider ${providerId} not found` };
    }

    const models = await provider.getModels();
    if (!models || models.length === 0) {
      return { connected: false, error: `Failed to fetch models for ${providerId}` };
    }

    return { connected: true };
  } catch (error: any) {
    console.error(`Error testing connectivity for ${providerId}:`, error);
    return { 
      connected: false, 
      error: error.message || `Failed to test connectivity for ${providerId}` 
    };
  }
}

// Get provider information
export function getProviderInfo(providerId: string) {
  const provider = getProvider(providerId);
  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    name: provider.name,
    label: provider.label,
    icon: provider.icon,
    color: provider.color,
    description: provider.description,
    model: provider.model,
    maxTokens: provider.maxTokens,
    supportsStreaming: provider.supportsStreaming,
    supportsSystemPrompt: provider.supportsSystemPrompt,
    maxContextLength: provider.maxContextLength,
    availableModels: provider.availableModels
  };
}

// Get all provider information
export function getAllProviderInfo() {
  return Object.keys(getProviderIds()).map(id => getProviderInfo(id)).filter(Boolean);
}

// Helper function to get provider IDs
function getProviderIds(): string[] {
  return Object.keys(require('./index').providerRegistry);
}

export default {
  validateApiKey,
  testProviderConnectivity,
  getProviderInfo,
  getAllProviderInfo
};