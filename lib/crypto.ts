
// lib/crypto.ts
import { isServer, b64encode, b64decode, utf8encode, utf8decode } from "./runtime";

let nodeCryptoModule: Promise<typeof import("crypto")> | null = null;

async function getNodeCrypto() {
  if (!nodeCryptoModule) {
    nodeCryptoModule = import("crypto");
  }
  return nodeCryptoModule;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength &&
    bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer;
  }

  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

// 32 bytes key from any string seed
export async function deriveKey(seed: string): Promise<Uint8Array> {
  // SHA-256(seed) -> 32 bytes
  if (isServer) {
    const { createHash } = await import("crypto");
    const h = createHash("sha256").update(seed, "utf8").digest();
    return new Uint8Array(h);
  } else {
    const buf = await crypto.subtle.digest("SHA-256", toArrayBuffer(utf8encode(seed)));
    return new Uint8Array(buf);
  }
}

export async function randomBytes(n: number): Promise<Uint8Array> {
  if (isServer) {
    const { randomBytes } = await getNodeCrypto();
    const buffer = randomBytes(n);
    const out = new Uint8Array(n);
    out.set(buffer);
    return out;
  }
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export async function aesGcmEncrypt(keyRaw: Uint8Array, plaintext: string): Promise<string> {
  const iv = await randomBytes(12);
  if (isServer) {
    const { createCipheriv } = await getNodeCrypto();
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyRaw), Buffer.from(iv));
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = new Uint8Array(iv.length + ct.length + tag.length);
    payload.set(iv, 0);
    payload.set(ct, iv.length);
    payload.set(tag, iv.length + ct.length);
    return `v2:gcm:${b64encode(payload)}`;
  } else {
    const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyRaw), "AES-GCM", false, ["encrypt"]);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(utf8encode(plaintext))
    );
    const tagAppended = new Uint8Array(ct); // WebCrypto includes tag
    const payload = new Uint8Array(iv.length + tagAppended.length);
    payload.set(iv, 0);
    payload.set(tagAppended, iv.length);
    return `v2:gcm:${b64encode(payload)}`;
  }
}

export async function aesGcmDecrypt(keyRaw: Uint8Array, token: string): Promise<string> {
  if (!token.startsWith("v2:gcm:")) throw new Error("not-gcm");
  const payload = b64decode(token.slice("v2:gcm:".length));
  const iv = payload.slice(0, 12);
  const data = payload.slice(12);
  if (isServer) {
    const { createDecipheriv } = await getNodeCrypto();
    // Node expects tag separated; last 16 bytes are GCM tag
    if (data.length < 17) throw new Error("cipher-too-short");
    const tag = data.slice(data.length - 16);
    const ct = data.slice(0, data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyRaw), Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } else {
    const key = await crypto.subtle.importKey("raw", toArrayBuffer(keyRaw), "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(data)
    );
    return utf8decode(new Uint8Array(pt));
  }
}

// LEGACY FUNCTIONS FOR BACKWARD COMPATIBILITY

// Generate a random encryption key
export async function generateEncryptionKey(): Promise<string> {
  const bytes = await randomBytes(16);
  if (isServer) {
    return Buffer.from(bytes).toString('hex');
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate base64 string
export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  try {
    // Check if string contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;
    
    // Try to decode and check if successful
    if (isServer) {
      Buffer.from(str, 'base64');
    } else {
      atob(str);
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Encrypt text with a key
export async function encrypt(text: string, key: string): Promise<string> {
  if (isServer) {
    const keyData = Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
    const { createCipheriv } = await getNodeCrypto();
    const iv = Buffer.from(await randomBytes(12));
    const cipher = createCipheriv("aes-256-gcm", keyData, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, encrypted, tag]);
    return combined.toString("base64");
  } else {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(keyData),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = encoder.encode(text);
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      cryptoKey,
      toArrayBuffer(encodedText)
    );
    
    const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
    encryptedArray.set(iv);
    encryptedArray.set(new Uint8Array(encryptedData), iv.length);
    
    return btoa(String.fromCharCode(...encryptedArray));
  }
}

// Decrypt text with a key
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  try {
    // Validate base64 format first
    if (!isValidBase64(encryptedText)) {
      throw new Error('Invalid encrypted data format');
    }

    if (isServer) {
      const { createDecipheriv } = await getNodeCrypto();
      const keyData = Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
      const combined = Buffer.from(encryptedText, 'base64');
      const iv = combined.slice(0, 12);
      const tag = combined.slice(-16);
      const encrypted = combined.slice(12, -16);
      
      const decipher = createDecipheriv("aes-256-gcm", keyData, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } else {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(keyData),
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const encryptedArray = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      const iv = encryptedArray.slice(0, 12);
      const encryptedData = encryptedArray.slice(12);
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(encryptedData)
      );
      
      return decoder.decode(decryptedData);
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data. Invalid key or corrupted data.');
  }
}

// DEPRECATED: These functions are kept for backward compatibility only
// Use crypto-enterprise.ts for new implementations

import { encryptApiKey as secureEncryptApiKey, decryptApiKey as secureDecryptApiKey } from './crypto-enterprise';

const DEFAULT_KEY = 'default-encryption-key-12345678901234567890123456789012';

/**
 * @deprecated Use encryptApiKey from crypto-enterprise.ts instead
 */
export async function encryptApiKey(apiKey: string, provider: string = 'unknown'): Promise<string> {
  if (!apiKey) return '';
  
  console.warn('Using deprecated encryptApiKey function. Please migrate to crypto-enterprise.ts');
  
  try {
    // Fallback to secure implementation
    return await secureEncryptApiKey(apiKey, provider);
  } catch (error) {
    console.error('Secure encryption failed, using legacy method:', error);
    
    // Legacy XOR encryption as absolute fallback
    const encrypted = Array.from(apiKey)
      .map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ DEFAULT_KEY.charCodeAt(i % DEFAULT_KEY.length))
      )
      .join('');
    
    return isServer ? Buffer.from(encrypted).toString('base64') : btoa(encrypted);
  }
}

/**
 * @deprecated Use decryptApiKey from crypto-enterprise.ts instead
 */
export async function decryptApiKey(encryptedApiKey: string, provider: string = 'unknown'): Promise<string> {
  if (!encryptedApiKey) return '';
  
  console.warn('Using deprecated decryptApiKey function. Please migrate to crypto-enterprise.ts');
  
  try {
    // Try secure decryption first
    if (encryptedApiKey.startsWith('v3:AES-256-GCM:')) {
      return await secureDecryptApiKey(encryptedApiKey, provider);
    }
    
    // Legacy decryption for old data
    if (!isValidBase64(encryptedApiKey)) {
      return encryptedApiKey;
    }
    
    const encrypted = isServer ? Buffer.from(encryptedApiKey, 'base64').toString() : atob(encryptedApiKey);
    const decrypted = Array.from(encrypted)
      .map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ DEFAULT_KEY.charCodeAt(i % DEFAULT_KEY.length))
      )
      .join('');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedApiKey;
  }
}
