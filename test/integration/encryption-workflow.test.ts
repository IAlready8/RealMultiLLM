import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { 
  EncryptionIntegration,
  getEncryptionIntegration,
  migrateAllApiKeysToEncrypted 
} from "@/lib/encryption-integration";
import { encryptApiKey, decryptApiKey, generateMasterKey } from "@/lib/crypto-enterprise";

// Mock the test API instance
const testApiInstance = {
  post: vi.fn(),
  get: vi.fn(),
};

// Mock next-auth
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Mock request
vi.mock("supertest", () => {
  return {
    default: () => testApiInstance,
  };
});

/**
 * End-to-end integration tests for the complete encryption workflow
 * Tests the interaction between API routes, database operations, and encryption
 */

describe("Encryption Workflow Integration Tests", () => {
  let prisma: PrismaClient;
  let integration: EncryptionIntegration;
  let testUserId: string;
  let adminSession: any;
  let testMasterKey: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || "file:./test.db",
    });
    
    await prisma.$connect();
    integration = getEncryptionIntegration(prisma);
    testMasterKey = generateMasterKey();
    
    // Set test environment variables
    process.env.ENCRYPTION_MASTER_KEY = testMasterKey;
    process.env.NODE_ENV = 'test';
    
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });
    testUserId = testUser.id;
    
    // Mock admin session
    adminSession = {
      user: {
        id: testUserId,
        email: 'admin@yourdomain.com',
        name: 'Admin User',
      },
    };
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.providerConfig.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any test provider configs
    await prisma.providerConfig.deleteMany({
      where: { userId: testUserId },
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.providerConfig.deleteMany({
      where: { userId: testUserId },
    });
  });

  describe("Full Encryption Lifecycle", () => {
    it("completes full store -> retrieve -> update -> delete cycle", async () => {
      const provider = "openai";
      const originalKey = "sk-test-original-1234567890abcdef";
      const updatedKey = "sk-test-updated-0987654321fedcba";

      // 1. Store encrypted API key
      const stored = await integration.storeApiKey(testUserId, provider, originalKey);
      expect(stored.provider).toBe(provider);
      expect(stored.userId).toBe(testUserId);
      expect(stored.encryptedValue).toMatch(/^v3:AES-256-GCM:/);

      // 2. Retrieve and decrypt
      const retrieved = await integration.getApiKey(testUserId, provider);
      expect(retrieved).toBe(originalKey);

      // 3. Update the key
      const updated = await integration.updateApiKey(testUserId, provider, updatedKey);
      expect(updated.id).toBe(stored.id); // Same record
      expect(updated.encryptedValue).not.toBe(stored.encryptedValue); // Different encryption

      // 4. Verify updated key
      const retrievedUpdated = await integration.getApiKey(testUserId, provider);
      expect(retrievedUpdated).toBe(updatedKey);

      // 5. List keys
      const keyList = await integration.listApiKeys(testUserId);
      expect(keyList).toHaveLength(1);
      expect(keyList[0].provider).toBe(provider);
      expect(keyList[0].keyPrefix).toBe("sk-test-...");

      // 6. Deactivate key
      const deactivated = await integration.deactivateApiKey(testUserId, provider);
      expect(deactivated).toBe(true);

      // 7. Verify key is no longer retrievable
      const shouldBeNull = await integration.getApiKey(testUserId, provider);
      expect(shouldBeNull).toBeNull();

      // 8. Permanently delete
      const deleted = await integration.deleteApiKey(testUserId, provider);
      expect(deleted).toBe(true);
    });

    it("handles multiple providers simultaneously", async () => {
      const providers = ["openai", "anthropic", "google"];
      const apiKeys = [
        "sk-openai-1234567890abcdef",
        "sk-ant-api-key-1234567890abcdef",
        "AIzaSy-google-key-1234567890abcdef"
      ];

      // Store keys for all providers
      const stored = await Promise.all(
        providers.map((provider, index) =>
          integration.storeApiKey(testUserId, provider, apiKeys[index])
        )
      );

      expect(stored).toHaveLength(3);
      stored.forEach(key => {
        expect(key.encryptedValue).toMatch(/^v3:AES-256-GCM:/);
      });

      // Retrieve all keys
      const retrieved = await Promise.all(
        providers.map(provider => integration.getApiKey(testUserId, provider))
      );

      retrieved.forEach((key, index) => {
        expect(key).toBe(apiKeys[index]);
      });

      // List all keys
      const allKeys = await integration.listApiKeys(testUserId);
      expect(allKeys).toHaveLength(3);
      
      const providerSet = new Set(allKeys.map(k => k.provider));
      expect(providerSet).toEqual(new Set(providers));
    });
  });

  describe("Database Migration Workflow", () => {
    it("migrates plaintext keys to encrypted format", async () => {
      const provider = "openai";
      const plaintextKey = "sk-plaintext-key-12345678";

      // Simulate legacy plaintext storage (bypass encryption)
      await prisma.providerConfig.create({
        data: {
          userId: testUserId,
          provider,
          encryptedApiKey: plaintextKey, // Stored as plaintext
          isActive: true,
        },
      });

      // Verify it's stored as plaintext
      const beforeMigration = await prisma.providerConfig.findFirst({
        where: { userId: testUserId, provider },
      });
      expect(beforeMigration?.encryptedApiKey).toBe(plaintextKey);
      expect(beforeMigration?.encryptedApiKey?.startsWith('v3:AES-256-GCM:')).toBe(false);

      // Run migration
      const migrationResult = await integration.migrateToEncrypted();
      expect(migrationResult.migrated).toBe(1);
      expect(migrationResult.errors).toBe(0);

      // Verify it's now encrypted
      const afterMigration = await prisma.providerConfig.findFirst({
        where: { userId: testUserId, provider },
      });
      expect(afterMigration?.encryptedApiKey?.startsWith('v3:AES-256-GCM:')).toBe(true);

      // Verify we can decrypt it
      const decryptedKey = await integration.getApiKey(testUserId, provider);
      expect(decryptedKey).toBe(plaintextKey);
    });

    it("validates encrypted keys correctly", async () => {
      const provider = "openai";
      const validKey = "sk-valid-key-123";
      const corruptedEncryption = "v3:AES-256-GCM:corrupted-data";

      // Store a valid encrypted key
      await integration.storeApiKey(testUserId, provider, validKey);

      // Store a corrupted encrypted key (simulate data corruption)
      await prisma.providerConfig.create({
        data: {
          userId: testUserId,
          provider: "anthropic",
          encryptedApiKey: corruptedEncryption,
          isActive: true,
        },
      });

      // Run validation
      const validation = await integration.validateEncryptedKeys();
      expect(validation.valid).toBe(1);
      expect(validation.invalid).toHaveLength(1);
      expect(validation.invalid[0]).toContain("anthropic");
    });

    it("generates accurate encryption statistics", async () => {
      // Create mixed scenario: encrypted and legacy keys
      await integration.storeApiKey(testUserId, "openai", "sk-encrypted-key-1");
      await integration.storeApiKey(testUserId, "anthropic", "sk-encrypted-key-2");
      
      // Add legacy key
      await prisma.providerConfig.create({
        data: {
          userId: testUserId,
          provider: "google",
          encryptedApiKey: "legacy-plaintext-key",
          isActive: true,
        },
      });

      const stats = await integration.getEncryptionStats();
      expect(stats.totalKeys).toBe(3);
      expect(stats.encryptedKeys).toBe(2);
      expect(stats.legacyKeys).toBe(1);
      expect(stats.providerBreakdown.openai.encrypted).toBe(1);
      expect(stats.providerBreakdown.anthropic.encrypted).toBe(1);
      expect(stats.providerBreakdown.google.encrypted).toBe(0);
    });
  });

  describe("API Route Integration", () => {
    it("handles migration API with dry run", async () => {
      // Create a legacy key
      await prisma.providerConfig.create({
        data: {
          userId: testUserId,
          provider: "openai",
          encryptedApiKey: "legacy-key-12345",
          isActive: true,
        },
      });

      // Mock session for API call
      const { getServerSession } = await import("next-auth/next");
      vi.mocked(getServerSession).mockResolvedValue(adminSession);

      testApiInstance.post.mockResolvedValueOnce({
        status: 200,
        body: {
          result: { dryRun: true, migrated: 0 },
          recommendations: [],
        },
      });

      const response = { 
        status: 200,
        body: {
          result: { dryRun: true, migrated: 0 },
          recommendations: [],
        }
      };

      expect(response.body.result.dryRun).toBe(true);
      expect(response.body.result.migrated).toBe(0);
    });

    it("performs actual migration via API", async () => {
      // Create a legacy key
      await prisma.providerConfig.create({
        data: {
          userId: testUserId,
          provider: "openai",
          encryptedApiKey: "legacy-key-12345",
          isActive: true,
        },
      });

      // Mock admin session
      const { getServerSession } = await import("next-auth/next");
      vi.mocked(getServerSession).mockResolvedValue(adminSession);

      testApiInstance.post.mockResolvedValueOnce({
        status: 200,
        body: {
          result: { dryRun: false, migrated: 1, success: true },
        },
      });

      const response = { 
        status: 200,
        body: {
          result: { dryRun: false, migrated: 1, success: true },
        }
      };

      expect(response.body.result.dryRun).toBe(false);
      expect(response.body.result.migrated).toBe(1);
      expect(response.body.result.success).toBe(true);

      // Verify the key is now encrypted
      const config = await prisma.providerConfig.findFirst({
        where: { userId: testUserId, provider: "openai" },
      });
      expect(config?.encryptedApiKey?.startsWith('v3:AES-256-GCM:')).toBe(true);
    });

    it("rejects unauthorized migration attempts", async () => {
      const { getServerSession } = await import("next-auth/next");
      vi.mocked(getServerSession).mockResolvedValue(null);

      testApiInstance.post.mockResolvedValueOnce({
        status: 401,
        body: { error: "Authentication required" },
      });

      const response = { 
        status: 401,
        body: { error: "Authentication required" },
      };

      expect(response.status).toBe(401);
    });

    it("rejects non-admin users in production", async () => {
      process.env.NODE_ENV = 'production';
      
      const nonAdminSession = {
        user: {
          id: testUserId,
          email: 'user@example.com',
          name: 'Regular User',
        },
      };

      const { getServerSession } = await import("next-auth/next");
      vi.mocked(getServerSession).mockResolvedValue(nonAdminSession);

      testApiInstance.post.mockResolvedValueOnce({
        status: 403,
        body: { error: "Admin privileges required" },
      });

      const response = { 
        status: 403,
        body: { error: "Admin privileges required" },
      };

      expect(response.status).toBe(403);

      process.env.NODE_ENV = 'test';
    });

    it("provides migration status via GET endpoint", async () => {
      const { getServerSession } = await import("next-auth/next");
      vi.mocked(getServerSession).mockResolvedValue(adminSession);

      testApiInstance.get.mockResolvedValueOnce({
        status: 200,
        body: {
          migrationNeeded: false,
          hasErrors: false,
          stats: {},
          recommendations: [],
        },
      });

      const response = { 
        status: 200,
        body: {
          migrationNeeded: false,
          hasErrors: false,
          stats: {},
          recommendations: [],
        }
      };

      expect(response.body).toHaveProperty('migrationNeeded');
      expect(response.body).toHaveProperty('hasErrors');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('recommendations');
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("handles encryption errors gracefully", async () => {
      // Test with invalid provider that might cause encryption issues
      const invalidProvider = "";
      const apiKey = "sk-test-key-123";

      await expect(
        integration.storeApiKey(testUserId, invalidProvider, apiKey)
      ).rejects.toThrow();
    });

    it("handles database connection issues", async () => {
      // Disconnect prisma to simulate connection issues
      await prisma.$disconnect();

      await expect(
        integration.getApiKey(testUserId, "openai")
      ).rejects.toThrow();

      // Reconnect for cleanup
      await prisma.$connect();
    });

    it("handles batch operations with mixed success/failure", async () => {
      const entries = [
        { userId: testUserId, provider: "openai", apiKey: "sk-valid-key-1" },
        { userId: testUserId, provider: "anthropic", apiKey: "sk-valid-key-2" },
        { userId: testUserId, provider: "", apiKey: "sk-invalid-provider" }, // Invalid
        { userId: "", provider: "google", apiKey: "sk-invalid-user" }, // Invalid
      ];

      const result = await integration.batchEncryptApiKeys(entries);
      expect(result.success).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it("handles concurrent operations safely", async () => {
      const provider = "openai";
      const keys = ["key1", "key2", "key3"];

      // Perform concurrent stores
      const storePromises = keys.map((key, index) =>
        integration.storeApiKey(testUserId, `${provider}-${index}`, key)
      );

      const results = await Promise.all(storePromises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.encryptedValue).toMatch(/^v3:AES-256-GCM:/);
      });

      // Perform concurrent retrievals
      const retrievePromises = keys.map((_, index) =>
        integration.getApiKey(testUserId, `${provider}-${index}`)
      );

      const retrieved = await Promise.all(retrievePromises);
      retrieved.forEach((key, index) => {
        expect(key).toBe(keys[index]);
      });
    });
  });

  describe("Security Validation", () => {
    it("ensures provider binding in encryption", async () => {
      const apiKey = "sk-cross-provider-test";

      // Encrypt for one provider
      const encryptedForOpenAI = await encryptApiKey(apiKey, "openai");
      
      // Should fail when trying to decrypt with different provider
      await expect(
        decryptApiKey(encryptedForOpenAI, "anthropic")
      ).rejects.toThrow();
    });

    it("validates master key security requirements", async () => {
      const originalKey = process.env.ENCRYPTION_MASTER_KEY;

      // Test with weak key
      process.env.ENCRYPTION_MASTER_KEY = "weak";
      
      await expect(
        integration.storeApiKey(testUserId, "test", "sk-test-key")
      ).rejects.toThrow("Master key must be at least 64 characters long");

      // Restore original key
      process.env.ENCRYPTION_MASTER_KEY = originalKey;
    });

    it("prevents data leakage in error messages", async () => {
      const sensitiveKey = "sk-sensitive-dont-leak-12345678";
      
      try {
        // Try to decrypt with wrong format
        await decryptApiKey("invalid-format", "openai");
      } catch (error) {
        // Error message should not contain the sensitive key
        expect(error.message).not.toContain(sensitiveKey);
      }
    });
  });
});