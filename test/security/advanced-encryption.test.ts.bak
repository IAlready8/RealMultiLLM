import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encryptSensitiveData,
  decryptSensitiveData,
  encryptApiKey,
  decryptApiKey,
  generateMasterKey,
  validateMasterKey,
  secureRandomBytes,
  deriveKeyMaterial,
  secureWipe
} from "@/lib/crypto-enterprise";

describe("Advanced Encryption Security Tests", () => {
  let testMasterKey: string;
  let testApiKey: string;
  let testProvider: string;

  beforeAll(() => {
    testMasterKey = generateMasterKey();
    testApiKey = "sk-test-1234567890abcdef1234567890abcdef1234567890abcdef";
    testProvider = "openai";
  });

  afterAll(() => {
    // Secure cleanup
    secureWipe(testMasterKey);
    secureWipe(testApiKey);
  });

  describe("Master Key Generation and Validation", () => {
    it("generates cryptographically strong master keys", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      
      expect(key1).not.toBe(key2);
      expect(key1).toHaveLength(128); // 64 bytes * 2 (hex encoding)
      expect(/^[0-9a-f]+$/.test(key1)).toBe(true);
    });

    it("validates master key strength", () => {
      const validKey = generateMasterKey();
      const weakKey = "short";
      const defaultKey = "default-encryption-key-12345678901234567890123456789012";
      
      expect(validateMasterKey(validKey)).toEqual({ valid: true });
      expect(validateMasterKey(weakKey)).toEqual({ 
        valid: false, 
        reason: "Key must be at least 64 characters long" 
      });
      expect(validateMasterKey(defaultKey)).toEqual({ 
        valid: false, 
        reason: "Cannot use default key in production" 
      });
    });

    it("rejects keys with insufficient entropy", () => {
      const lowEntropyKey = "a".repeat(64);
      const result = validateMasterKey(lowEntropyKey);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Key has insufficient entropy");
    });
  });

  describe("Cryptographic Primitives", () => {
    it("generates secure random bytes", () => {
      const bytes1 = secureRandomBytes(32);
      const bytes2 = secureRandomBytes(32);
      
      expect(bytes1).toHaveLength(32);
      expect(bytes2).toHaveLength(32);
      expect(bytes1).not.toEqual(bytes2);
      
      // Test for uniform distribution (basic check)
      const sum = bytes1.reduce((acc, byte) => acc + byte, 0);
      const avg = sum / bytes1.length;
      expect(avg).toBeGreaterThan(100); // Should be around 127.5 for uniform distribution
      expect(avg).toBeLessThan(155);
    });

    it("derives consistent key material with same inputs", async () => {
      const masterKey = "test-master-key-for-derivation-123456789012345678901234567890";
      const salt = secureRandomBytes(32);
      const info = "test-info";
      
      const keyMaterial1 = await deriveKeyMaterial(masterKey, salt, info);
      const keyMaterial2 = await deriveKeyMaterial(masterKey, salt, info);
      
      expect(keyMaterial1.key).toEqual(keyMaterial2.key);
      expect(keyMaterial1.salt).toEqual(keyMaterial2.salt);
    });

    it("derives different keys with different inputs", async () => {
      const masterKey = "test-master-key-for-derivation-123456789012345678901234567890";
      
      const keyMaterial1 = await deriveKeyMaterial(masterKey, undefined, "info1");
      const keyMaterial2 = await deriveKeyMaterial(masterKey, undefined, "info2");
      
      expect(keyMaterial1.key).not.toEqual(keyMaterial2.key);
      expect(keyMaterial1.salt).not.toEqual(keyMaterial2.salt);
    });
  });

  describe("Sensitive Data Encryption", () => {
    it("encrypts and decrypts data correctly", async () => {
      const plaintext = "sensitive-data-12345";
      
      const encrypted = await encryptSensitiveData(plaintext, testMasterKey);
      const decrypted = await decryptSensitiveData(encrypted, testMasterKey);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).toMatch(/^v3:AES-256-GCM:/);
    });

    it("produces different ciphertext for same plaintext", async () => {
      const plaintext = "same-data";
      
      const encrypted1 = await encryptSensitiveData(plaintext, testMasterKey);
      const encrypted2 = await encryptSensitiveData(plaintext, testMasterKey);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      const decrypted1 = await decryptSensitiveData(encrypted1, testMasterKey);
      const decrypted2 = await decryptSensitiveData(encrypted2, testMasterKey);
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it("supports additional authenticated data", async () => {
      const plaintext = "secret-message";
      const aad = "context-info";
      
      const encrypted = await encryptSensitiveData(plaintext, testMasterKey, aad);
      const decrypted = await decryptSensitiveData(encrypted, testMasterKey, aad);
      
      expect(decrypted).toBe(plaintext);
    });

    it("fails with wrong additional authenticated data", async () => {
      const plaintext = "secret-message";
      const aad1 = "correct-context";
      const aad2 = "wrong-context";
      
      const encrypted = await encryptSensitiveData(plaintext, testMasterKey, aad1);
      
      await expect(
        decryptSensitiveData(encrypted, testMasterKey, aad2)
      ).rejects.toThrow();
    });

    it("fails with wrong master key", async () => {
      const plaintext = "secret-data";
      const wrongKey = generateMasterKey();
      
      const encrypted = await encryptSensitiveData(plaintext, testMasterKey);
      
      await expect(
        decryptSensitiveData(encrypted, wrongKey)
      ).rejects.toThrow();
    });

    it("validates input parameters", async () => {
      await expect(
        encryptSensitiveData("", testMasterKey)
      ).rejects.toThrow("Plaintext cannot be empty");
      
      await expect(
        encryptSensitiveData("data", "short")
      ).rejects.toThrow("Master key must be at least 64 characters long");
      
      await expect(
        decryptSensitiveData("", testMasterKey)
      ).rejects.toThrow("Encrypted data cannot be empty");
    });
  });

  describe("API Key Encryption", () => {
    it("encrypts and decrypts API keys securely", async () => {
      const encrypted = await encryptApiKey(testApiKey, testProvider);
      const decrypted = await decryptApiKey(encrypted, testProvider);
      
      expect(decrypted).toBe(testApiKey);
      expect(encrypted).toMatch(/^v3:AES-256-GCM:/);
    });

    it("binds API key to provider", async () => {
      const encrypted = await encryptApiKey(testApiKey, "openai");
      
      await expect(
        decryptApiKey(encrypted, "anthropic")
      ).rejects.toThrow();
    });

    it("validates API key parameters", async () => {
      await expect(
        encryptApiKey("", "openai")
      ).rejects.toThrow("API key must be a non-empty string");
      
      await expect(
        encryptApiKey(testApiKey, "")
      ).rejects.toThrow("Provider must be a non-empty string");
      
      await expect(
        decryptApiKey("", "openai")
      ).rejects.toThrow("Encrypted API key must be a non-empty string");
    });
  });

  describe("Format Validation and Error Handling", () => {
    it("validates encrypted data format", async () => {
      const invalidFormats = [
        "invalid-format",
        "v3:WRONG-ALGO:data",
        "v99:AES-256-GCM:data",
        "v3:AES-256-GCM:invalid-base64-!@#$"
      ];
      
      for (const format of invalidFormats) {
        await expect(
          decryptSensitiveData(format, testMasterKey)
        ).rejects.toThrow();
      }
    });

    it("handles corrupted ciphertext gracefully", async () => {
      const plaintext = "test-data";
      const encrypted = await encryptSensitiveData(plaintext, testMasterKey);
      
      // Corrupt the base64 data
      const corrupted = encrypted.replace(/.$/, 'X');
      
      await expect(
        decryptSensitiveData(corrupted, testMasterKey)
      ).rejects.toThrow();
    });

    it("handles truncated ciphertext", async () => {
      const shortData = "v3:AES-256-GCM:" + btoa("short");
      
      await expect(
        decryptSensitiveData(shortData, testMasterKey)
      ).rejects.toThrow("Encrypted data too short");
    });
  });

  describe("Performance and Security Properties", () => {
    it("encrypts large data efficiently", async () => {
      const largeData = "x".repeat(10000);
      
      const start = Date.now();
      const encrypted = await encryptSensitiveData(largeData, testMasterKey);
      const decrypted = await decryptSensitiveData(encrypted, testMasterKey);
      const end = Date.now();
      
      expect(decrypted).toBe(largeData);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it("maintains constant-time properties for key operations", async () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      const plaintext = "timing-test-data";
      
      // Encrypt with both keys
      const encrypted1 = await encryptSensitiveData(plaintext, key1);
      const encrypted2 = await encryptSensitiveData(plaintext, key2);
      
      // Time decryption operations
      const times: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await decryptSensitiveData(encrypted1, key1);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }
      
      // Variance should be reasonable (not constant-time test, just basic check)
      const avg = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / times.length;
      
      expect(variance).toBeLessThan(avg * 2); // Rough check for timing consistency
    });
  });

  describe("Security Edge Cases", () => {
    it("handles empty and boundary values safely", async () => {
      const boundary = "a"; // Single character
      
      const encrypted = await encryptSensitiveData(boundary, testMasterKey);
      const decrypted = await decryptSensitiveData(encrypted, testMasterKey);
      
      expect(decrypted).toBe(boundary);
    });

    it("handles Unicode data correctly", async () => {
      const unicode = "🔐 Hello 世界 🚀";
      
      const encrypted = await encryptSensitiveData(unicode, testMasterKey);
      const decrypted = await decryptSensitiveData(encrypted, testMasterKey);
      
      expect(decrypted).toBe(unicode);
    });

    it("prevents key reuse attacks with proper IV generation", async () => {
      const plaintext = "repeated-message";
      const encrypted1 = await encryptSensitiveData(plaintext, testMasterKey);
      const encrypted2 = await encryptSensitiveData(plaintext, testMasterKey);
      
      // Extract IV portions (after salt)
      const data1 = encrypted1.split(':')[2];
      const data2 = encrypted2.split(':')[2];
      const payload1 = Buffer.from(data1, 'base64');
      const payload2 = Buffer.from(data2, 'base64');
      
      const iv1 = payload1.slice(32, 44); // Salt(32) + IV(12)
      const iv2 = payload2.slice(32, 44);
      
      expect(iv1).not.toEqual(iv2);
    });
  });

  describe("Memory Security", () => {
    it("secure wipe functionality", () => {
      const sensitiveArray = new Uint8Array([1, 2, 3, 4, 5]);
      const original = new Uint8Array(sensitiveArray);
      
      secureWipe(sensitiveArray);
      
      expect(sensitiveArray).not.toEqual(original);
      expect(sensitiveArray.every(byte => byte === 0)).toBe(true);
    });

    it("string wipe is symbolic (JS limitation)", () => {
      let sensitiveString = "sensitive-data";
      secureWipe(sensitiveString);
      
      // In JavaScript, strings are immutable, so this is just documentation
      // Real implementations would avoid creating strings for sensitive data
      expect(sensitiveString).toBe("sensitive-data"); // String unchanged
    });
  });
});