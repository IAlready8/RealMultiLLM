import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt, encryptApiKey, decryptApiKey } from "./crypto";
// import { encryptApiKey, decryptApiKey } from "./crypto-enterprise";
import { isServer } from "./runtime";

/**
 * Integration layer connecting enterprise encryption to database operations
 * Provides seamless encryption/decryption for API keys and sensitive data
 */

export interface EncryptedApiKey {
  id: string;
  provider: string;
  encryptedValue: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface ApiKeyMetadata {
  keyType: string;
  keyPrefix: string;
  expiresAt?: Date;
  permissions?: string[];
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
}

export class EncryptionIntegration {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store an encrypted API key in the database
   */
  async storeApiKey(
    userId: string,
    provider: string,
    apiKey: string,
    metadata?: ApiKeyMetadata
  ): Promise<EncryptedApiKey> {
    if (!isServer) {
      throw new Error("API key storage must be performed on the server");
    }

    try {
      // Encrypt the API key with provider binding
      const encryptedValue = await encryptApiKey(apiKey, provider);
      
      // Extract key prefix for display (e.g., "sk-...abc" -> "sk-...abc")
      const keyPrefix = this.extractKeyPrefix(apiKey);
      
      // Store in database with metadata
      const stored = await this.prisma.providerConfig.create({
        data: {
          userId,
          provider,
          apiKey: encryptedValue, // Use apiKey field instead of encryptedApiKey
          settings: JSON.stringify({
            keyType: metadata?.keyType || 'api_key',
            keyPrefix,
            expiresAt: metadata?.expiresAt,
            permissions: metadata?.permissions,
            rateLimit: metadata?.rateLimit,
          }),
          isActive: true,
          lastUsedAt: null,
        },
      });

      return {
        id: stored.id,
        provider: stored.provider,
        encryptedValue: stored.apiKey!,
        userId: stored.userId,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
        lastUsed: stored.lastUsedAt ?? undefined,
        isActive: stored.isActive,
      };
    } catch (error: any) {
      throw new Error(`Failed to store API key: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt an API key from the database
   */
  async getApiKey(userId: string, provider: string): Promise<string | null> {
    if (!isServer) {
      throw new Error("API key retrieval must be performed on the server");
    }

    try {
      const config = await this.prisma.providerConfig.findFirst({
        where: {
          userId,
          provider,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (!config || !config.apiKey) {
        return null;
      }

      // Decrypt the API key
      const decryptedKey = await decryptApiKey(config.apiKey, provider);
      
      // Update last used timestamp
      await this.updateLastUsed(config.id);
      
      return decryptedKey;
    } catch (error) {
      console.error(`Failed to retrieve API key for ${provider}:`, error);
      return null;
    }
  }

  /**
   * List all encrypted API keys for a user
   */
  async listApiKeys(userId: string): Promise<Array<Omit<EncryptedApiKey, 'encryptedValue'> & { keyPrefix: string }>> {
    try {
      const configs = await this.prisma.providerConfig.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          id: true,
          provider: true,
          userId: true,
          settings: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return configs.map(config => ({
        id: config.id,
        provider: config.provider,
        userId: config.userId,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        lastUsed: config.lastUsedAt ?? undefined,
        isActive: config.isActive,
        keyPrefix: '', // This field doesn't exist in the database schema, using empty string
      }));
    } catch (error: any) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }
  }

  /**
   * Update an existing API key
   */
  async updateApiKey(
    userId: string,
    provider: string,
    newApiKey: string,
    metadata?: Partial<ApiKeyMetadata>
  ): Promise<EncryptedApiKey> {
    if (!isServer) {
      throw new Error("API key update must be performed on the server");
    }

    try {
      // Find existing config
      const existing = await this.prisma.providerConfig.findFirst({
        where: {
          userId,
          provider,
          isActive: true,
        },
      });

      if (!existing) {
        throw new Error(`No active API key found for provider: ${provider}`);
      }

      // Encrypt new API key
      const encryptedValue = await encryptApiKey(newApiKey, provider);
      const keyPrefix = this.extractKeyPrefix(newApiKey);

      const existingSettings = existing.settings ? JSON.parse(existing.settings) : {};
      const newSettings = {
        ...existingSettings,
        keyPrefix,
        keyType: metadata?.keyType || existingSettings.keyType,
        expiresAt: metadata?.expiresAt !== undefined ? metadata.expiresAt : existingSettings.expiresAt,
        permissions: metadata?.permissions || existingSettings.permissions,
        rateLimit: metadata?.rateLimit || existingSettings.rateLimit,
      };

      // Update in database
      const updated = await this.prisma.providerConfig.update({
        where: { id: existing.id },
        data: {
          apiKey: encryptedValue,
          settings: JSON.stringify(newSettings),
          updatedAt: new Date(),
        },
      });

      return {
        id: updated.id,
        provider: updated.provider,
        encryptedValue: updated.apiKey!,
        userId: updated.userId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        lastUsed: updated.lastUsedAt ?? undefined,
        isActive: updated.isActive,
      };
    } catch (error: any) {
      throw new Error(`Failed to update API key: ${error.message}`);
    }
  }

  /**
   * Deactivate an API key (soft delete)
   */
  async deactivateApiKey(userId: string, provider: string): Promise<boolean> {
    try {
      const result = await this.prisma.providerConfig.updateMany({
        where: {
          userId,
          provider,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error(`Failed to deactivate API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Permanently delete an API key
   */
  async deleteApiKey(userId: string, provider: string): Promise<boolean> {
    if (!isServer) {
      throw new Error("API key deletion must be performed on the server");
    }

    try {
      const result = await this.prisma.providerConfig.deleteMany({
        where: {
          userId,
          provider,
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error(`Failed to delete API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Migrate existing plaintext API keys to encrypted format
   */
  async migrateToEncrypted(): Promise<{ migrated: number; errors: number }> {
    if (!isServer) {
      throw new Error("Migration must be performed on the server");
    }

    let migrated = 0;
    let errors = 0;

    try {
      // Find all configs with unencrypted API keys
      const configs = await this.prisma.providerConfig.findMany({
        where: {
          apiKey: {
            not: null,
          },
          // Identify unencrypted keys by checking format
          NOT: {
            apiKey: {
              startsWith: 'v3:AES-256-GCM:',
            },
          },
        },
      });

      for (const config of configs) {
        try {
          if (config.apiKey && !config.apiKey.startsWith('v3:AES-256-GCM:')) {
            // This appears to be a plaintext key, encrypt it
            const encryptedValue = await encryptApiKey(config.apiKey, config.provider);
            
            await this.prisma.providerConfig.update({
              where: { id: config.id },
              data: {
                apiKey: encryptedValue,
                updatedAt: new Date(),
              },
            });
            
            migrated++;
          }
        } catch (error: any) {
          console.error(`Failed to migrate key for ${config.provider}:`, error);
          errors++;
        }
      }

      return { migrated, errors };
    } catch (error: any) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Validate all encrypted API keys can be decrypted
   */
  async validateEncryptedKeys(): Promise<{ valid: number; invalid: string[] }> {
    if (!isServer) {
      throw new Error("Validation must be performed on the server");
    }

    let valid = 0;
    const invalid: string[] = [];

    try {
      const configs = await this.prisma.providerConfig.findMany({
        where: {
          apiKey: {
            not: null,
          },
          isActive: true,
        },
      });

      for (const config of configs) {
        try {
          if (config.apiKey) {
            await decryptApiKey(config.apiKey, config.provider);
            valid++;
          }
        } catch (error: any) {
          invalid.push(`${config.provider} (${config.id}): ${error.message}`);
        }
      }

      return { valid, invalid };
    } catch (error: any) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Batch encrypt multiple API keys
   */
  async batchEncryptApiKeys(
    entries: Array<{ userId: string; provider: string; apiKey: string; metadata?: ApiKeyMetadata }>
  ): Promise<{ success: number; errors: Array<{ provider: string; error: string }> }> {
    let success = 0;
    const errors: Array<{ provider: string; error: string }> = [];

    for (const entry of entries) {
      try {
        await this.storeApiKey(entry.userId, entry.provider, entry.apiKey, entry.metadata);
        success++;
      } catch (error) {
        errors.push({
          provider: entry.provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { success, errors };
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats(): Promise<{
    totalKeys: number;
    encryptedKeys: number;
    legacyKeys: number;
    providerBreakdown: Record<string, { total: number; encrypted: number }>;
  }> {
    try {
      const allConfigs = await this.prisma.providerConfig.findMany({
        where: {
          apiKey: {
            not: null,
          },
        },
        select: {
          provider: true,
          apiKey: true,
        },
      });

      const totalKeys = allConfigs.length;
      let encryptedKeys = 0;
      let legacyKeys = 0;
      const providerBreakdown: Record<string, { total: number; encrypted: number }> = {};

      for (const config of allConfigs) {
        if (!providerBreakdown[config.provider]) {
          providerBreakdown[config.provider] = { total: 0, encrypted: 0 };
        }
        
        providerBreakdown[config.provider].total++;
        
        if (config.apiKey?.startsWith('v3:AES-256-GCM:')) {
          encryptedKeys++;
          providerBreakdown[config.provider].encrypted++;
        } else {
          legacyKeys++;
        }
      }

      return {
        totalKeys,
        encryptedKeys,
        legacyKeys,
        providerBreakdown,
      };
    } catch (error: any) {
      throw new Error(`Failed to get encryption stats: ${error.message}`);
    }
  }

  private async updateLastUsed(configId: string): Promise<void> {
    try {
      await this.prisma.providerConfig.update({
        where: { id: configId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error: any) {
      // Don't fail the main operation if we can't update the timestamp
      console.warn(`Failed to update last used timestamp: ${error.message}`);
    }
  }

  private extractKeyPrefix(apiKey: string): string {
    if (apiKey.length <= 8) {
      return apiKey;
    }
    
    // Show first 8 characters + "..."
    return `${apiKey.substring(0, 8)}...`;
  }
}

// Singleton instance
let encryptionIntegration: EncryptionIntegration | null = null;

/**
 * Get the singleton encryption integration instance
 */
export function getEncryptionIntegration(prisma?: PrismaClient): EncryptionIntegration {
  if (!isServer) {
    throw new Error("Encryption integration is only available on the server");
  }
  
  if (!encryptionIntegration) {
    if (!prisma) {
      throw new Error("Prisma client is required to initialize encryption integration");
    }
    encryptionIntegration = new EncryptionIntegration(prisma);
  }
  
  return encryptionIntegration;
}

/**
 * Helper functions for common operations
 */
export async function secureStoreApiKey(
  prisma: PrismaClient,
  userId: string,
  provider: string,
  apiKey: string
): Promise<EncryptedApiKey> {
  const integration = getEncryptionIntegration(prisma);
  return integration.storeApiKey(userId, provider, apiKey);
}

export async function secureGetApiKey(
  prisma: PrismaClient,
  userId: string,
  provider: string
): Promise<string | null> {
  const integration = getEncryptionIntegration(prisma);
  return integration.getApiKey(userId, provider);
}

export async function migrateAllApiKeysToEncrypted(
  prisma: PrismaClient
): Promise<{ migrated: number; errors: number }> {
  const integration = getEncryptionIntegration(prisma);
  return integration.migrateToEncrypted();
}