import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockPrisma } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({
  default: createMockPrisma(),
}));

vi.mock('@/lib/crypto', () => ({
  encryptApiKey: vi.fn().mockResolvedValue('encrypted-key'),
  decryptApiKey: vi.fn().mockResolvedValue('decrypted-key'),
}));

import { ConfigurationManager, ConfigurationError } from '@/lib/config-manager';
import { mockProviderConfigs } from '../test-utils';

const mockPrisma = createMockPrisma();

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = ConfigurationManager.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSystemConfig', () => {
    it('should return default system configuration', async () => {
      const config = await configManager.getSystemConfig();
      
      expect(config).toHaveProperty('providers', {});
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('security');
      expect(config).toHaveProperty('database');
      expect(config.features.streaming).toBe(true);
      expect(config.features.analytics).toBe(true);
      expect(config.features.rateLimit).toBe(true);
    });

    it('should cache configuration', async () => {
      const config1 = await configManager.getSystemConfig();
      const config2 = await configManager.getSystemConfig();
      
      expect(config1).toBe(config2);
    });

    it('should force refresh when requested', async () => {
      const config1 = await configManager.getSystemConfig();
      const config2 = await configManager.getSystemConfig(true);
      
      expect(config1).not.toBe(config2);
    });
  });

  describe('getProviderConfig', () => {
    it('should return null for non-existent provider', async () => {
      mockPrisma.providerConfig.findUnique.mockResolvedValue(null);
      
      const config = await configManager.getProviderConfig('user-1', 'nonexistent');
      expect(config).toBeNull();
    });

    it('should return null for inactive provider', async () => {
      mockPrisma.providerConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        userId: 'user-1',
        provider: 'openai',
        apiKey: 'encrypted-key',
        settings: '{}',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const config = await configManager.getProviderConfig('user-1', 'openai');
      expect(config).toBeNull();
    });

    it('should return decrypted provider configuration', async () => {
      mockPrisma.providerConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        userId: 'user-1',
        provider: 'openai',
        apiKey: 'encrypted-key',
        settings: JSON.stringify({
          baseUrl: 'https://api.openai.com',
          models: ['gpt-4'],
          rateLimits: { requests: 60, window: 60000 },
        }),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const config = await configManager.getProviderConfig('user-1', 'openai');
      
      expect(config).toEqual({
        apiKey: 'decrypted-key',
        baseUrl: 'https://api.openai.com',
        models: ['gpt-4'],
        rateLimits: { requests: 60, window: 60000 },
        isActive: true,
        settings: {
          baseUrl: 'https://api.openai.com',
          models: ['gpt-4'],
          rateLimits: { requests: 60, window: 60000 },
        },
      });
    });

    it('should handle missing settings gracefully', async () => {
      mockPrisma.providerConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        userId: 'user-1',
        provider: 'openai',
        apiKey: 'encrypted-key',
        settings: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const config = await configManager.getProviderConfig('user-1', 'openai');
      
      expect(config?.models).toEqual(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']);
      expect(config?.rateLimits).toEqual({ requests: 60, window: 60000 });
    });
  });

  describe('updateProviderConfig', () => {
    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        apiKey: '',
        models: [],
        rateLimits: { requests: 0, window: 500 },
      };
      
      const result = await configManager.updateProviderConfig('user-1', 'openai', invalidConfig as any);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(mockPrisma.providerConfig.upsert).not.toHaveBeenCalled();
    });

    it('should save valid configuration', async () => {
      const validConfig = mockProviderConfigs.openai;
      
      mockPrisma.providerConfig.upsert.mockResolvedValue({
        id: 'config-1',
        userId: 'user-1',
        provider: 'openai',
        apiKey: 'encrypted-key',
        settings: '{}',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const result = await configManager.updateProviderConfig('user-1', 'openai', validConfig);
      
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(mockPrisma.providerConfig.upsert).toHaveBeenCalledWith({
        where: { userId_provider: { userId: 'user-1', provider: 'openai' } },
        update: expect.objectContaining({
          apiKey: 'encrypted-key',
          isActive: true,
        }),
        create: expect.objectContaining({
          userId: 'user-1',
          provider: 'openai',
          apiKey: 'encrypted-key',
          isActive: true,
        }),
      });
    });

    it('should handle database errors', async () => {
      const validConfig = mockProviderConfigs.openai;
      mockPrisma.providerConfig.upsert.mockRejectedValue(new Error('Database error'));
      
      await expect(
        configManager.updateProviderConfig('user-1', 'openai', validConfig)
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe('deleteProviderConfig', () => {
    it('should delete provider configuration', async () => {
      mockPrisma.providerConfig.delete.mockResolvedValue({} as any);
      
      await configManager.deleteProviderConfig('user-1', 'openai');
      
      expect(mockPrisma.providerConfig.delete).toHaveBeenCalledWith({
        where: { userId_provider: { userId: 'user-1', provider: 'openai' } },
      });
    });

    it('should handle deletion errors', async () => {
      mockPrisma.providerConfig.delete.mockRejectedValue(new Error('Not found'));
      
      await expect(
        configManager.deleteProviderConfig('user-1', 'openai')
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe('validateSystemConfig', () => {
    it('should validate correct system configuration', () => {
      const validConfig = {
        providers: {},
        features: {
          streaming: true,
          analytics: true,
          rateLimit: true,
          errorReporting: true,
          debug: false,
        },
        security: {
          sessionTimeout: 86400,
          maxLoginAttempts: 5,
          encryptionKeyRotation: 90,
          requireMFA: false,
        },
        database: {
          connectionPool: { min: 2, max: 10, acquireTimeoutMillis: 60000 },
          queryTimeout: 30000,
          enableLogging: false,
        },
        version: '1.0.0',
        lastUpdated: new Date(),
      };
      
      const result = configManager.validateSystemConfig(validConfig);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid system configuration', () => {
      const invalidConfig = {
        features: {
          streaming: 'yes',
        },
        security: {
          sessionTimeout: 100,
        },
      };
      
      const result = configManager.validateSystemConfig(invalidConfig as any);
      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate correct provider configuration', () => {
      const result = configManager.validateProviderConfig(mockProviderConfigs.openai);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid provider configuration', () => {
      const invalidConfig = {
        apiKey: '',
        models: 'not-an-array',
        rateLimits: {
          requests: -1,
          window: 100,
        },
      };
      
      const result = configManager.validateProviderConfig(invalidConfig as any);
      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('testProviderConnection', () => {
    it('should test OpenAI connection', async () => {
      vi.doMock('@/services/llm-providers/openai-service', () => ({
        OpenAIService: vi.fn().mockImplementation(() => ({
          testConnection: vi.fn().mockResolvedValue(true),
        })),
      }));
      
      const result = await configManager.testProviderConnection('openai', mockProviderConfigs.openai);
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
    });

    it('should handle connection test failure', async () => {
      vi.doMock('@/services/llm-providers/openai-service', () => ({
        OpenAIService: vi.fn().mockImplementation(() => ({
          testConnection: vi.fn().mockRejectedValue(new Error('Invalid API key')),
        })),
      }));
      
      const result = await configManager.testProviderConnection('openai', mockProviderConfigs.openai);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle unknown provider', async () => {
      const result = await configManager.testProviderConnection('unknown-provider', mockProviderConfigs.openai);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown provider');
    });
  });

  describe('getAllProviderConfigs', () => {
    it('should return all active provider configurations', async () => {
      mockPrisma.providerConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          userId: 'user-1',
          provider: 'openai',
          apiKey: 'encrypted-openai-key',
          settings: JSON.stringify({ models: ['gpt-4'] }),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'config-2',
          userId: 'user-1',
          provider: 'anthropic',
          apiKey: 'encrypted-anthropic-key',
          settings: JSON.stringify({ models: ['claude-3-opus'] }),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      
      const configs = await configManager.getAllProviderConfigs('user-1');
      
      expect(Object.keys(configs)).toEqual(['openai', 'anthropic']);
      expect(configs.openai.apiKey).toBe('decrypted-key');
      expect(configs.anthropic.apiKey).toBe('decrypted-key');
      expect(mockPrisma.providerConfig.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
      });
    });

    it('should return empty object when no configurations exist', async () => {
      mockPrisma.providerConfig.findMany.mockResolvedValue([]);
      
      const configs = await configManager.getAllProviderConfigs('user-1');
      expect(configs).toEqual({});
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = configManager.getAvailableProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('googleai');
      expect(providers).toContain('openrouter');
    });
  });

  describe('getDefaultModels', () => {
    it('should return default models for known provider', () => {
      const models = configManager.getDefaultModels('openai');
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });

    it('should return empty array for unknown provider', () => {
      const models = configManager.getDefaultModels('unknown');
      expect(models).toEqual([]);
    });
  });

  describe('getDefaultRateLimits', () => {
    it('should return default rate limits for known provider', () => {
      const limits = configManager.getDefaultRateLimits('openai');
      expect(limits).toEqual({ requests: 60, window: 60000 });
    });

    it('should return fallback rate limits for unknown provider', () => {
      const limits = configManager.getDefaultRateLimits('unknown');
      expect(limits).toEqual({ requests: 60, window: 60000 });
    });
  });

  describe('cache management', () => {
    it('should invalidate cache', async () => {
      const config1 = await configManager.getSystemConfig();
      configManager.invalidateCache();
      const config2 = await configManager.getSystemConfig();
      
      expect(config1).not.toBe(config2);
    });

    it('should refresh cache', async () => {
      const config1 = await configManager.getSystemConfig();
      await configManager.refreshCache();
      const config2 = await configManager.getSystemConfig();
      
      expect(config1).not.toBe(config2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all systems working', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      
      const health = await configManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details.database).toBe('healthy');
      expect(health.details.configuration).toBe('healthy');
    });

    it('should return unhealthy status when database fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));
      
      const health = await configManager.healthCheck();
      
      expect(health.status).toBe('degraded');
      expect(health.details.database).toBe('unhealthy');
      expect(health.details.databaseError).toBeDefined();
    });
  });
});
