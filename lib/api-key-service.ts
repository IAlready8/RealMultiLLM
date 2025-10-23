import { deriveKey, aesGcmEncrypt, aesGcmDecrypt } from './crypto';
import prisma from './prisma';
import logger from './logger';

// Server-side encryption key from environment
const getEncryptionKey = async (): Promise<Uint8Array> => {
  const seed =
    process.env.API_KEY_ENCRYPTION_SEED || 'default-encryption-seed-change-in-production';
  if (!seed || seed.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SEED must be at least 32 characters long');
  }
  return await deriveKey(seed);
};

export interface ProviderConfig {
  id: string;
  provider: string;
  isActive: boolean;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsedAt?: Date;
}

/**
 * Validate an API key format before storing
 */
export function validateApiKey(provider: string, apiKey: string): { valid: boolean; message?: string } {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return { valid: false, message: 'API key cannot be empty' };
  }

  // Apply provider-specific validation rules
  switch (provider.toLowerCase()) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, message: 'OpenAI API key must start with "sk-"' };
      }
      if (apiKey.length < 20) {
        return { valid: false, message: 'OpenAI API key appears to be too short' };
      }
      break;
    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return { valid: false, message: 'Anthropic API key must start with "sk-ant-"' };
      }
      if (apiKey.length < 20) {
        return { valid: false, message: 'Anthropic API key appears to be too short' };
      }
      break;
    case 'google':
      if (!apiKey.startsWith('AIza')) {
        return { valid: false, message: 'Google API key must start with "AIza"' };
      }
      if (apiKey.length < 30) {
        return { valid: false, message: 'Google API key appears to be too short' };
      }
      break;
    case 'openrouter':
      if (!apiKey.startsWith('sk-or-')) {
        return { valid: false, message: 'OpenRouter API key must start with "sk-or-"' };
      }
      if (apiKey.length < 30) {
        return { valid: false, message: 'OpenRouter API key appears to be too short' };
      }
      break;
    case 'grok':
      if (!apiKey.startsWith('xai-')) {
        return { valid: false, message: 'Grok API key must start with "xai-"' };
      }
      if (apiKey.length < 20) {
        return { valid: false, message: 'Grok API key appears to be too short' };
      }
      break;
    // Add more providers as needed
    default:
      if (apiKey.length < 5) {
        return { valid: false, message: 'API key appears to be too short' };
      }
  }

  return { valid: true };
}

/**
 * Store an encrypted API key for a user and provider
 */
export async function storeUserApiKey(
  userId: string,
  provider: string,
  apiKey: string,
  settings?: Record<string, any>,
): Promise<ProviderConfig> {
  // Validate inputs
  const validation = validateApiKey(provider, apiKey);
  if (!validation.valid) {
    throw new Error(validation.message || 'Invalid API key format');
  }

  const encryptionKey = await getEncryptionKey();
  const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey.trim());

  try {
    const config = await prisma.providerConfig.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        apiKey: encryptedApiKey,
        settings: settings ? (settings as any) : null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider,
        apiKey: encryptedApiKey,
        settings: settings ? (settings as any) : null,
        isActive: true,
      },
    });

    logger.info('API key stored successfully', { userId, provider });
    
    return {
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      settings: ((): Record<string, any> | undefined => {
        const s: any = (config as any).settings;
        if (!s) return undefined;
        return typeof s === 'string' ? JSON.parse(s) : s;
      })(),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      usageCount: config.usageCount || 0,
      lastUsedAt: config.lastUsedAt || undefined,
    };
  } catch (error) {
    logger.error('Failed to store API key', { userId, provider, error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to store API key due to server error');
  }
}

/**
 * Retrieve and decrypt an API key for a user and provider
 */
export async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const config = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!config || !config.apiKey || !config.isActive) {
      return null;
    }

    const encryptionKey = await getEncryptionKey();
    return await aesGcmDecrypt(encryptionKey, config.apiKey);
  } catch (error) {
    logger.error('Failed to decrypt API key', { userId, provider, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Get all provider configurations for a user (without API keys)
 */
export async function getUserProviderConfigs(userId: string): Promise<ProviderConfig[]> {
  try {
    const configs = await prisma.providerConfig.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        isActive: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        usageCount: true,
        lastUsedAt: true,
      },
    });

    return configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      settings: ((): Record<string, any> | undefined => {
        const s: any = (config as any).settings;
        if (!s) return undefined;
        return typeof s === 'string' ? JSON.parse(s) : s;
      })(),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      usageCount: config.usageCount || 0,
      lastUsedAt: config.lastUsedAt || undefined,
    }));
  } catch (error) {
    logger.error('Failed to fetch provider configs', { userId, error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to fetch provider configurations');
  }
}

/**
 * Delete a provider configuration
 */
export async function deleteUserProviderConfig(userId: string, provider: string): Promise<void> {
  try {
    await prisma.providerConfig.updateMany({
      where: {
        userId,
        provider,
      },
      data: {
        isActive: false,
        apiKey: null,  // Also clear the API key
        updatedAt: new Date(),
      },
    });
    
    logger.info('API key deleted', { userId, provider });
  } catch (error) {
    logger.error('Failed to delete API key', { userId, provider, error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to delete API key');
  }
}

/**
 * Check if user has a valid API key for a provider
 */
export async function hasValidApiKey(userId: string, provider: string): Promise<boolean> {
  try {
    const config = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    return !!(config && config.apiKey && config.isActive);
  } catch (error) {
    logger.error('Failed to check API key validity', { userId, provider, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Update provider settings without changing the API key
 */
export async function updateProviderSettings(
  userId: string,
  provider: string,
  settings: Record<string, any>,
): Promise<ProviderConfig | null> {
  try {
    const result = await prisma.providerConfig.updateMany({
      where: {
        userId,
        provider,
        isActive: true,
      },
      data: {
        settings: settings as any,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    const updated = await prisma.providerConfig.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!updated) return null;

    return {
      id: updated.id,
      provider: updated.provider,
      isActive: updated.isActive,
      settings: ((): Record<string, any> | undefined => {
        const s: any = (updated as any).settings;
        if (!s) return undefined;
        return typeof s === 'string' ? JSON.parse(s) : s;
      })(),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      usageCount: updated.usageCount || 0,
      lastUsedAt: updated.lastUsedAt || undefined,
    };
  } catch (error) {
    logger.error('Failed to update provider settings', { userId, provider, error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to update provider settings');
  }
}

/**
 * Increment usage count for a provider configuration
 */
export async function incrementProviderUsage(userId: string, provider: string): Promise<void> {
  try {
    await prisma.providerConfig.updateMany({
      where: {
        userId,
        provider,
      },
      data: {
        usageCount: {
          increment: 1
        },
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to increment usage count', { userId, provider, error: error instanceof Error ? error.message : String(error) });
  }
}