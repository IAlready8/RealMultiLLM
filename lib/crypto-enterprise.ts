/* 
 * Enterprise crypto module temporarily disabled due to Node.js Buffer compatibility
 * All encryption functionality is available in lib/crypto.ts
 */

export interface EncryptionResult {
  ciphertext: string;
  version: string;
  algorithm: string;
}

export interface KeyMaterial {
  key: Uint8Array;
  salt: Uint8Array;
}

export function placeholder() {
  console.warn('crypto-enterprise temporarily disabled - use lib/crypto.ts instead');
}

export async function encryptSensitiveData(): Promise<string> {
  throw new Error('crypto-enterprise temporarily disabled - use encrypt() from lib/crypto.ts instead');
}

export async function decryptSensitiveData(): Promise<string> {
  throw new Error('crypto-enterprise temporarily disabled - use decrypt() from lib/crypto.ts instead');
}

export async function encryptApiKey(): Promise<string> {
  throw new Error('crypto-enterprise temporarily disabled - use encrypt() from lib/crypto.ts instead');
}

export async function decryptApiKey(): Promise<string> {
  throw new Error('crypto-enterprise temporarily disabled - use decrypt() from lib/crypto.ts instead');
}

export function secureRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  } else {
    // Fallback for test environments
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }
}