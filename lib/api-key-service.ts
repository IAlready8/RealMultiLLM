import prisma from './prisma'
import { deriveKey, aesGcmEncrypt, aesGcmDecrypt } from './crypto'

// Server-side encryption key from environment
const getEncryptionKey = async (): Promise<Uint8Array> => {
  const seed = process.env.API_KEY_ENCRYPTION_SEED || 'default-encryption-seed-change-in-production'
  return await deriveKey(seed)
}

export interface ProviderConfig {
  id: string
  provider: string
  isActive: boolean
  settings?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

/**
 * Store an encrypted API key for a user and provider
 */
export async function storeUserApiKey(
  userId: string,
  provider: string,
  apiKey: string,
  settings?: Record<string, any>
): Promise<ProviderConfig> {
  const encryptionKey = await getEncryptionKey()
  const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey)

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
  })

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
  }
}

/**
 * Retrieve and decrypt an API key for a user and provider
 */
export async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  })

  if (!config || !config.apiKey || !config.isActive) {
    return null
  }

  try {
    const encryptionKey = await getEncryptionKey()
    return await aesGcmDecrypt(encryptionKey, config.apiKey)
  } catch (error) {
    console.error(`Failed to decrypt API key for ${provider}:`, error)
    return null
  }
}

/**
 * Get all provider configurations for a user (without API keys)
 */
export async function getUserProviderConfigs(userId: string): Promise<ProviderConfig[]> {
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
    },
  })

  return configs.map(config => ({
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
  }))
}

/**
 * Delete a provider configuration
 */
export async function deleteUserProviderConfig(
  userId: string,
  provider: string
): Promise<void> {
  await prisma.providerConfig.updateMany({
    where: {
      userId,
      provider,
    },
    data: {
      isActive: false,
      apiKey: null,
      updatedAt: new Date(),
    },
  })
}

/**
 * Check if user has a valid API key for a provider
 */
export async function hasValidApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  const config = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  })

  return !!(config && config.apiKey && config.isActive)
}

/**
 * Update provider settings without changing the API key
 */
export async function updateProviderSettings(
  userId: string,
  provider: string,
  settings: Record<string, any>
): Promise<ProviderConfig | null> {
  const config = await prisma.providerConfig.updateMany({
    where: {
      userId,
      provider,
      isActive: true,
    },
    data: {
      settings: settings as any,
      updatedAt: new Date(),
    },
  })

  if (config.count === 0) {
    return null
  }

  const updated = await prisma.providerConfig.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  })

  if (!updated) return null

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
  }
}
