import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { webcrypto } from 'crypto';
import { Buffer } from 'buffer';

// --- Crypto Implementation ---
async function deriveKey(masterKey: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await webcrypto.subtle.importKey(
        'raw',
        encoder.encode(masterKey),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    const salt = encoder.encode('RealMultiLLM-salt');
    return webcrypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function aesGcmEncrypt(key: CryptoKey, plaintext: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return Buffer.from(combined).toString('base64');
}

async function aesGcmDecrypt(key: CryptoKey, encryptedData: string): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

async function encryptForStorage(key: string, data: any): Promise<string> {
  const jsonString = JSON.stringify(data);
  const cryptoKey = await deriveKey(key);
  return aesGcmEncrypt(cryptoKey, jsonString);
}

async function decryptFromStorage(key: string, encryptedData: string): Promise<any> {
  const cryptoKey = await deriveKey(key);
  const jsonString = await aesGcmDecrypt(cryptoKey, encryptedData);
  return JSON.parse(jsonString);
}


// --- Secure Storage Implementation ---

const STORAGE_PREFIX = 'realmultillm_secure_';
const DEVICE_KEY_KEY = 'realmultillm_device_key';

async function getDeviceKey(): Promise<string> {
    const storedKey = localStorage.getItem(DEVICE_KEY_KEY);
    if (storedKey) return storedKey;
    const newKey = webcrypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_KEY, newKey);
    return newKey;
}

class SecureLocalStorage {
  private deviceKey: string | null = null;

  private async ensureDeviceKey(): Promise<void> {
    if (!this.deviceKey) {
      this.deviceKey = await getDeviceKey();
    }
  }

  async setItem(key: string, value: any): Promise<void> {
    await this.ensureDeviceKey();
    const encryptedValue = await encryptForStorage(this.deviceKey!, value);
    localStorage.setItem(STORAGE_PREFIX + key, encryptedValue);
  }

  async getItem<T = any>(key: string): Promise<T | null> {
    await this.ensureDeviceKey();
    const encryptedValue = localStorage.getItem(STORAGE_PREFIX + key);
    if (!encryptedValue) return null;
    try {
        return await decryptFromStorage(this.deviceKey!, encryptedValue);
    } catch {
        return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + key);
  }
}

const secureLocalStorage = new SecureLocalStorage();

async function storeApiKey(provider: string, apiKey: string): Promise<void> {
  await secureLocalStorage.setItem(`api_key_${provider}`, { apiKey, timestamp: Date.now() });
}

async function getApiKey(provider: string): Promise<string | null> {
  const data = await secureLocalStorage.getItem<{ apiKey: string; timestamp: number }>(`api_key_${provider}`);
  return data?.apiKey || null;
}


// --- Tests ---

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });


describe('Combined Crypto and Secure Storage Tests', () => {

    beforeAll(() => {
        if (typeof global.crypto === 'undefined') {
            Object.defineProperty(global, 'crypto', { value: webcrypto });
        }
    });

    beforeEach(() => {
        localStorageMock.clear();
    });

    describe('Crypto Functions', () => {
        it('should encrypt and decrypt a string successfully', async () => {
            const masterKey = 'a-very-secret-master-key';
            const cryptoKey = await deriveKey(masterKey);
            const plaintext = 'my-super-secret-data';
            const encrypted = await aesGcmEncrypt(cryptoKey, plaintext);
            const decrypted = await aesGcmDecrypt(cryptoKey, encrypted);
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('Secure Storage Functions', () => {
        it('should store and retrieve an API key securely', async () => {
            const provider = 'openai';
            const apiKey = 'sk-12345';
            await storeApiKey(provider, apiKey);
            const retrievedKey = await getApiKey(provider);
            expect(retrievedKey).toBe(apiKey);
        });

        it('should return null for a non-existent API key', async () => {
            const retrievedKey = await getApiKey('non-existent');
            expect(retrievedKey).toBeNull();
        });
    });
});
