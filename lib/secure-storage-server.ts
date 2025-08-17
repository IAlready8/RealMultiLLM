/**
 * Server-side secure storage for API keys
 * Uses environment variables for server-side storage
 */

import { getEncryptionKey } from '@/lib/env-validation';

const API_KEY_PREFIX = 'apiKey_';

// Server-side API key storage using environment variables
export async function getStoredApiKey(provider: string): Promise<string | null> {
  // Check if we're on the server
  if (typeof window !== 'undefined') {
    // If we're on the client, delegate to the client-side version
    const { getStoredApiKey: clientGetStoredApiKey } = await import('./secure-storage');
    return clientGetStoredApiKey(provider);
  }

  try {
    // On server, check environment variables for API keys
    const envVarName = `${provider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envVarName];
    
    if (apiKey) {
      return apiKey;
    }

    // Fallback to encrypted storage if available
    const encryptedKey = process.env[`ENCRYPTED_${envVarName}`];
    if (encryptedKey) {
      // For now, return the encrypted key as-is since we can't decrypt server-side
      // This would need proper server-side decryption implementation
      return encryptedKey;
    }

    return null;
  } catch (error) {
    console.error(`Error retrieving API key for ${provider}:`, error);
    return null;
  }
}

// Server-side validation (simplified)
export function validateApiKeyFormat(provider: string, apiKey: string): boolean {
  if (!apiKey) return false;
  
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'claude':
      return apiKey.length > 20;
    case 'google':
      return apiKey.length > 20;
    case 'groq':
      return apiKey.startsWith('gsk_') && apiKey.length > 30;
    case 'ollama':
      return true; // Ollama doesn't require API keys
    default:
      return apiKey.length > 8;
  }
}

// For server-side only - store API key is not implemented
export async function storeApiKey(provider: string, apiKey: string): Promise<void> {
  if (typeof window !== 'undefined') {
    // If we're on the client, delegate to the client-side version
    const { storeApiKey: clientStoreApiKey } = await import('./secure-storage');
    return clientStoreApiKey(provider, apiKey);
  }
  
  // Server-side storage is not implemented for security reasons
  console.warn(`Server-side storage of API keys is not supported. Use environment variables instead.`);
}