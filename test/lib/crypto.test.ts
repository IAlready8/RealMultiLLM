import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey, isValidBase64 } from '@/lib/crypto';

describe('Crypto Utilities', () => {
  describe('encryptApiKey', () => {
    it('should encrypt a plain text API key', () => {
      const apiKey = 'sk-test-api-key-123';
      const encrypted = encryptApiKey(apiKey);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(apiKey);
      expect(typeof encrypted).toBe('string');
    });

    it('should return consistent encrypted values for the same input', () => {
      const apiKey = 'sk-test-api-key-123';
      const encrypted1 = encryptApiKey(apiKey);
      const encrypted2 = encryptApiKey(apiKey);

      // Our implementation is deterministic for simplicity
      expect(encrypted1).toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const encrypted = encryptApiKey('');
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decryptApiKey', () => {
    it('should decrypt an encrypted API key', () => {
      const apiKey = 'sk-test-api-key-123';
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should handle plain text API keys (fallback)', () => {
      const plainKey = 'sk-plain-text-key';
      const result = decryptApiKey(plainKey);

      expect(result).toBe(plainKey);
    });

    it('should handle invalid encrypted data gracefully', () => {
      const invalidEncrypted = 'invalid-encrypted-data';
      const result = decryptApiKey(invalidEncrypted);

      // Should fallback to returning the original string
      expect(result).toBe(invalidEncrypted);
    });

    it('should handle empty strings', () => {
      const result = decryptApiKey('');
      expect(result).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(decryptApiKey(null as any)).toBe('');
      expect(decryptApiKey(undefined as any)).toBe('');
    });
  });

  describe('isValidBase64', () => {
    it('should return true for valid base64 strings', () => {
      const validBase64 = btoa('test string');
      expect(isValidBase64(validBase64)).toBe(true);
    });

    it('should return false for invalid base64 strings', () => {
      expect(isValidBase64('invalid-base64!')).toBe(false);
      expect(isValidBase64('sk-plain-text')).toBe(false);
      expect(isValidBase64('')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidBase64(null as any)).toBe(false);
      expect(isValidBase64(undefined as any)).toBe(false);
    });
  });

  describe('encryption round-trip', () => {
    it('should successfully encrypt and decrypt various API key formats', () => {
      const testKeys = [
        'sk-test-openai-key-123456789',
        'claude-api-key-abcdef',
        'google-ai-key-xyz789',
        'very-long-api-key-with-special-chars-!@#$%^&*()',
        '123456789',
        'a',
        'Multi\nLine\nKey'
      ];

      testKeys.forEach(key => {
        const encrypted = encryptApiKey(key);
        const decrypted = decryptApiKey(encrypted);
        expect(decrypted).toBe(key);
      });
    });
  });
});