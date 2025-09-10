import { isServer } from "./runtime";
import { getEncryptionKey, isProduction } from "./env";
import { randomBytes as nodeRandomBytes, createHash, createCipheriv, createDecipheriv } from "crypto";

/**
 * Enterprise-grade encryption utilities using AES-256-GCM only
 * All encryption is authenticated and includes integrity checks
 * Uses HKDF for key derivation and proper IV generation
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

// Encryption algorithm versions for future migration support
const ENCRYPTION_VERSION = 'v3';
const ALGORITHM = 'AES-256-GCM';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32; // 256 bits for key derivation
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Generate cryptographically secure random bytes
 */
export function secureRandomBytes(length: number): Uint8Array {
  if (isServer) {
    return new Uint8Array(nodeRandomBytes(length));
  } else {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
}

/**
 * Derive encryption key using HKDF (HMAC-based Key Derivation Function)
 * This provides proper key stretching and domain separation
 */
export async function deriveKeyMaterial(masterKey: string, salt?: Uint8Array, info?: string): Promise<KeyMaterial> {
  const actualSalt = salt || secureRandomBytes(SALT_LENGTH);
  const keyInfo = new TextEncoder().encode(info || 'RealMultiLLM-API-Key-Encryption');
  
  if (isServer) {
    // Use Node.js crypto for HKDF
    const { hkdf } = await import('crypto');
    const { promisify } = await import('util');
    const hkdfAsync = promisify(hkdf);
    
    const derivedKey = await hkdfAsync('sha256', masterKey, actualSalt, keyInfo, KEY_LENGTH);
    return {
      key: new Uint8Array(derivedKey),
      salt: actualSalt
    };
  } else {
    // Use Web Crypto API
    const masterKeyBytes = new TextEncoder().encode(masterKey);
    const importedKey = await crypto.subtle.importKey(
      'raw',
      masterKeyBytes,
      'HKDF',
      false,
      ['deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: actualSalt,
        info: keyInfo
      },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const keyBytes = await crypto.subtle.exportKey('raw', derivedKey);
    return {
      key: new Uint8Array(keyBytes),
      salt: actualSalt
    };
  }
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Returns base64-encoded result with version and metadata
 */
export async function encryptSensitiveData(
  plaintext: string,
  masterKey?: string,
  additionalData?: string
): Promise<string> {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const actualMasterKey = masterKey || getEncryptionKey();
  if (!actualMasterKey || actualMasterKey.length < 64) {
    throw new Error('Master key must be at least 64 characters long');
  }

  const keyMaterial = await deriveKeyMaterial(actualMasterKey);
  const iv = secureRandomBytes(IV_LENGTH);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const additionalDataBytes = additionalData ? new TextEncoder().encode(additionalData) : new Uint8Array(0);

  if (isServer) {
    const cipher = createCipheriv('aes-256-gcm', keyMaterial.key, iv);
    if (additionalDataBytes.length > 0) {
      cipher.setAAD(additionalDataBytes);
    }
    
    const encrypted = Buffer.concat([
      cipher.update(plaintextBytes),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Format: salt(32) + iv(12) + tag(16) + ciphertext(variable)
    const result = Buffer.concat([
      keyMaterial.salt,
      iv,
      tag,
      encrypted
    ]);
    
    return `${ENCRYPTION_VERSION}:${ALGORITHM}:${result.toString('base64')}`;
  } else {
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: additionalDataBytes.length > 0 ? additionalDataBytes : undefined
      },
      key,
      plaintextBytes
    );
    
    // Format: salt(32) + iv(12) + encrypted_with_tag(variable)
    const result = new Uint8Array(keyMaterial.salt.length + iv.length + encrypted.byteLength);
    result.set(keyMaterial.salt, 0);
    result.set(iv, keyMaterial.salt.length);
    result.set(new Uint8Array(encrypted), keyMaterial.salt.length + iv.length);
    
    return `${ENCRYPTION_VERSION}:${ALGORITHM}:${btoa(String.fromCharCode(...result))}`;
  }
}

/**
 * Decrypt sensitive data
 * Handles version migration and validates integrity
 */
export async function decryptSensitiveData(
  encryptedData: string,
  masterKey?: string,
  additionalData?: string
): Promise<string> {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }

  const actualMasterKey = masterKey || getEncryptionKey();
  if (!actualMasterKey) {
    throw new Error('Master key is required for decryption');
  }

  // Parse version and algorithm
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [version, algorithm, data] = parts;
  
  // Version compatibility check
  if (version !== ENCRYPTION_VERSION) {
    // In production, log this for monitoring key rotation needs
    if (isProduction()) {
      console.warn(`Decrypting data with legacy version: ${version}`);
    }
    
    // For now, only support current version
    if (version === 'v1' || version === 'v2') {
      throw new Error(`Legacy encryption version ${version} no longer supported. Please re-encrypt your data.`);
    }
  }
  
  if (algorithm !== ALGORITHM) {
    throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
  }

  let payload: Uint8Array;
  try {
    if (isServer) {
      payload = new Uint8Array(Buffer.from(data, 'base64'));
    } else {
      payload = new Uint8Array(
        atob(data).split('').map(char => char.charCodeAt(0))
      );
    }
  } catch (error) {
    throw new Error('Invalid base64 encoding in encrypted data');
  }

  // Extract components
  if (payload.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Encrypted data too short');
  }

  const salt = payload.slice(0, SALT_LENGTH);
  const iv = payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const additionalDataBytes = additionalData ? new TextEncoder().encode(additionalData) : new Uint8Array(0);

  // Derive the same key using the stored salt
  const keyMaterial = await deriveKeyMaterial(actualMasterKey, salt);

  if (isServer) {
    const tag = payload.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const decipher = createDecipheriv('aes-256-gcm', keyMaterial.key, iv);
    decipher.setAuthTag(tag);
    if (additionalDataBytes.length > 0) {
      decipher.setAAD(additionalDataBytes);
    }
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } else {
    const encryptedWithTag = payload.slice(SALT_LENGTH + IV_LENGTH);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: additionalDataBytes.length > 0 ? additionalDataBytes : undefined
      },
      key,
      encryptedWithTag
    );
    
    return new TextDecoder().decode(decrypted);
  }
}

/**
 * Secure API key encryption with domain-specific key derivation
 */
export async function encryptApiKey(apiKey: string, provider: string): Promise<string> {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }
  
  if (!provider || typeof provider !== 'string') {
    throw new Error('Provider must be a non-empty string');
  }
  
  // Use provider as additional authenticated data
  return encryptSensitiveData(apiKey, undefined, `provider:${provider}`);
}

/**
 * Secure API key decryption with domain validation
 */
export async function decryptApiKey(encryptedApiKey: string, provider: string): Promise<string> {
  if (!encryptedApiKey || typeof encryptedApiKey !== 'string') {
    throw new Error('Encrypted API key must be a non-empty string');
  }
  
  if (!provider || typeof provider !== 'string') {
    throw new Error('Provider must be a non-empty string');
  }
  
  return decryptSensitiveData(encryptedApiKey, undefined, `provider:${provider}`);
}

/**
 * Generate a cryptographically secure master key
 * Use this to generate ENCRYPTION_MASTER_KEY for your environment
 */
export function generateMasterKey(): string {
  const randomBytes = secureRandomBytes(64); // 512 bits
  return Buffer.from(randomBytes).toString('hex');
}

/**
 * Validate master key strength
 */
export function validateMasterKey(key: string): { valid: boolean; reason?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'Key must be a non-empty string' };
  }
  
  if (key.length < 64) {
    return { valid: false, reason: 'Key must be at least 64 characters long' };
  }
  
  if (key === 'default-encryption-key-12345678901234567890123456789012') {
    return { valid: false, reason: 'Cannot use default key in production' };
  }
  
  // Check for sufficient entropy (basic check)
  const uniqueChars = new Set(key.split('')).size;
  if (uniqueChars < 16) {
    return { valid: false, reason: 'Key has insufficient entropy' };
  }
  
  return { valid: true };
}

/**
 * Securely wipe sensitive data from memory (best effort)
 */
export function secureWipe(data: string | Uint8Array): void {
  if (typeof data === 'string') {
    // JavaScript strings are immutable, so this is symbolic
    // In a real implementation, you'd avoid creating strings for sensitive data
    data = '';
  } else {
    // Clear the array
    data.fill(0);
  }
}