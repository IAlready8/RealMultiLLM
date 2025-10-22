import type { PrismaClient } from '@prisma/client';
import { encryptApiKey, decryptApiKey } from './crypto';
import { isServer } from './runtime';

/**
 * Integration layer connecting enterprise encryption to database operations.
 * Provides consistent API key storage, retrieval, and metadata handling.
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
    window: number;
  };
}

export class EncryptionIntegration {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Store an encrypted API key in the database.
   */
  async storeApiKey(
    userId: string,
    provider: string,
    apiKey: string,
    metadata?: ApiKeyMetadata,
  ): Promise<EncryptedApiKey> {
    this.assertServerEnvironment('storeApiKey');

    const encryptedValue = await encryptApiKey(apiKey, provider);
    const keyPrefix = this.extractKeyPrefix(apiKey);

    const stored = await this.prisma.providerConfig.create({
      data: {
        userId,
        provider,
        apiKey: encryptedValue,
        settings: JSON.stringify({
          keyType: metadata?.keyType ?? 'api_key',
          keyPrefix,
          expiresAt: metadata?.expiresAt,
          permissions: metadata?.permissions,
          rateLimit: metadata?.rateLimit,
        }),
        isActive: true,
        lastUsedAt: null,
      },
    });

    return this.normalizeStoredConfig(stored);
  }

  /**
   * Retrieve and decrypt an API key for a provider.
   */
  async getApiKey(userId: string, provider: string): Promise<string | null> {
    this.assertServerEnvironment('getApiKey');

    const config = await this.prisma.providerConfig.findFirst({
      where: { userId, provider, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!config?.apiKey) {
      return null;
    }

    const decrypted = await decryptApiKey(config.apiKey, provider);
    await this.updateLastUsed(config.id);
    return decrypted;
  }

  /**
   * List active API keys for a user (without decrypting).
   */
  async listApiKeys(
    userId: string,
  ): Promise<Array<Omit<EncryptedApiKey, 'encryptedValue'> & { keyPrefix: string }>> {
    const configs = await this.prisma.providerConfig.findMany({
      where: { userId, isActive: true },
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
      orderBy: { updatedAt: 'desc' },
    });

    return configs.map((config) => {
      const settings = this.parseSettings(config.settings);
      return {
        id: config.id,
        provider: config.provider,
        userId: config.userId,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        lastUsed: config.lastUsedAt ?? undefined,
        isActive: config.isActive,
        keyPrefix: typeof settings.keyPrefix === 'string' ? settings.keyPrefix : '',
      };
    });
  }

  /**
   * Encrypt and persist a new API key for an existing provider.
   */
  async updateApiKey(
    userId: string,
    provider: string,
    newApiKey: string,
    metadata?: Partial<ApiKeyMetadata>,
  ): Promise<EncryptedApiKey> {
    this.assertServerEnvironment('updateApiKey');

    const existing = await this.prisma.providerConfig.findFirst({
      where: { userId, provider, isActive: true },
    });

    if (!existing) {
      throw new Error(`No active API key found for provider: ${provider}`);
    }

    const encryptedValue = await encryptApiKey(newApiKey, provider);
    const keyPrefix = this.extractKeyPrefix(newApiKey);
    const currentSettings = this.parseSettings(existing.settings);
    const updatedSettings = JSON.stringify({
      ...currentSettings,
      keyPrefix,
      keyType: metadata?.keyType ?? currentSettings.keyType,
      expiresAt: metadata?.expiresAt ?? currentSettings.expiresAt,
      permissions: metadata?.permissions ?? currentSettings.permissions,
      rateLimit: metadata?.rateLimit ?? currentSettings.rateLimit,
    });

    const updated = await this.prisma.providerConfig.update({
      where: { id: existing.id },
      data: {
        apiKey: encryptedValue,
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return this.normalizeStoredConfig(updated);
  }

  /**
   * Soft-delete an API key.
   */
  async deactivateApiKey(userId: string, provider: string): Promise<boolean> {
    const result = await this.prisma.providerConfig.updateMany({
      where: { userId, provider, isActive: true },
      data: { isActive: false, updatedAt: new Date() },
    });
    return result.count > 0;
  }

  /**
   * Permanently remove an API key.
   */
  async deleteApiKey(userId: string, provider: string): Promise<boolean> {
    this.assertServerEnvironment('deleteApiKey');

    const result = await this.prisma.providerConfig.deleteMany({
      where: { userId, provider },
    });
    return result.count > 0;
  }

  /**
   * Encrypt any legacy plaintext API keys in the database.
   */
  async migrateToEncrypted(): Promise<{ migrated: number; errors: number }> {
    this.assertServerEnvironment('migrateToEncrypted');

    const configs = await this.prisma.providerConfig.findMany({
      where: {
        apiKey: { not: null },
        NOT: { apiKey: { startsWith: 'v3:AES-256-GCM:' } },
      },
      select: { id: true, provider: true, apiKey: true },
    });

    let migrated = 0;
    let errors = 0;

    for (const config of configs) {
      if (!config.apiKey) continue;
      try {
        const encryptedValue = await encryptApiKey(config.apiKey, config.provider);
        await this.prisma.providerConfig.update({
          where: { id: config.id },
          data: { apiKey: encryptedValue, updatedAt: new Date() },
        });
        migrated += 1;
      } catch (error) {
        console.error(`Failed to migrate key for ${config.provider}:`, error);
        errors += 1;
      }
    }

    return { migrated, errors };
  }

  /**
   * Verify all encrypted keys can be decrypted.
   */
  async validateEncryptedKeys(): Promise<{ valid: number; invalid: string[] }> {
    this.assertServerEnvironment('validateEncryptedKeys');

    const configs = await this.prisma.providerConfig.findMany({
      where: {
        apiKey: { not: null },
        isActive: true,
      },
      select: { id: true, provider: true, apiKey: true },
    });

    let valid = 0;
    const invalid: string[] = [];

    for (const config of configs) {
      if (!config.apiKey) continue;
      try {
        await decryptApiKey(config.apiKey, config.provider);
        valid += 1;
      } catch (error) {
        invalid.push(`${config.provider} (${config.id}): ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    return { valid, invalid };
  }

  /**
   * Encrypt and store multiple API keys.
   */
  async batchEncryptApiKeys(
    entries: Array<{ userId: string; provider: string; apiKey: string; metadata?: ApiKeyMetadata }>,
  ): Promise<{ success: number; errors: Array<{ provider: string; error: string }> }> {
    let success = 0;
    const errors: Array<{ provider: string; error: string }> = [];

    for (const entry of entries) {
      try {
        await this.storeApiKey(entry.userId, entry.provider, entry.apiKey, entry.metadata);
        success += 1;
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
   * Collect statistics about encrypted keys.
   */
  async getEncryptionStats(): Promise<{
    totalKeys: number;
    encryptedKeys: number;
    legacyKeys: number;
    providerBreakdown: Record<string, { total: number; encrypted: number }>;
  }> {
    const configs = await this.prisma.providerConfig.findMany({
      where: { apiKey: { not: null } },
      select: { provider: true, apiKey: true },
    });

    let encryptedKeys = 0;
    let legacyKeys = 0;
    const providerBreakdown: Record<string, { total: number; encrypted: number }> = {};

    for (const config of configs) {
      if (!providerBreakdown[config.provider]) {
        providerBreakdown[config.provider] = { total: 0, encrypted: 0 };
      }

      providerBreakdown[config.provider].total += 1;
      if (config.apiKey?.startsWith('v3:AES-256-GCM:')) {
        encryptedKeys += 1;
        providerBreakdown[config.provider].encrypted += 1;
      } else {
        legacyKeys += 1;
      }
    }

    return {
      totalKeys: configs.length,
      encryptedKeys,
      legacyKeys,
      providerBreakdown,
    };
  }

  private normalizeStoredConfig(stored: {
    id: string;
    provider: string;
    apiKey: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date | null;
    isActive: boolean;
  }): EncryptedApiKey {
    return {
      id: stored.id,
      provider: stored.provider,
      encryptedValue: stored.apiKey ?? '',
      userId: stored.userId,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      lastUsed: stored.lastUsedAt ?? undefined,
      isActive: stored.isActive,
    };
  }

  private async updateLastUsed(configId: string): Promise<void> {
    try {
      await this.prisma.providerConfig.update({
        where: { id: configId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      console.warn('Failed to update provider key last-used timestamp', error);
    }
  }

  private extractKeyPrefix(apiKey: string): string {
    if (apiKey.length <= 8) {
      return apiKey;
    }
    return `${apiKey.slice(0, 8)}...`;
  }

  private parseSettings(settings: string | null): Record<string, unknown> {
    if (!settings) {
      return {};
    }
    try {
      return JSON.parse(settings) as Record<string, unknown>;
    } catch (error) {
      console.warn('Failed to parse provider configuration settings', error);
      return {};
    }
  }

  private assertServerEnvironment(operation: string): void {
    if (!isServer) {
      throw new Error(`${operation} must be performed on the server`);
    }
  }
}

let singleton: EncryptionIntegration | null = null;

export function getEncryptionIntegration(prisma?: PrismaClient): EncryptionIntegration {
  if (!singleton) {
    if (!prisma) {
      throw new Error('Prisma client is required to initialize encryption integration');
    }
    singleton = new EncryptionIntegration(prisma);
  }
  return singleton;
}

export async function secureStoreApiKey(
  prisma: PrismaClient,
  userId: string,
  provider: string,
  apiKey: string,
): Promise<EncryptedApiKey> {
  const integration = getEncryptionIntegration(prisma);
  return integration.storeApiKey(userId, provider, apiKey);
}

export async function secureGetApiKey(
  prisma: PrismaClient,
  userId: string,
  provider: string,
): Promise<string | null> {
  const integration = getEncryptionIntegration(prisma);
  return integration.getApiKey(userId, provider);
}

export async function migrateAllApiKeysToEncrypted(
  prisma: PrismaClient,
): Promise<{ migrated: number; errors: number }> {
  const integration = getEncryptionIntegration(prisma);
  return integration.migrateToEncrypted();
}
