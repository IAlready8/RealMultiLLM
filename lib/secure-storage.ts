/**
 * Secure Storage - Utilities for securely storing and retrieving sensitive data
 * 
 * 3-STEP PLAN:
 * 1. Implement secure encryption/decryption using Web Crypto API
 * 2. Create persistent storage with localStorage
 * 3. Add key derivation for password-based encryption
 */

const API_KEY_PREFIX = 'apiKey_';
const MASTER_KEY_SALT = 'RealMultiLLM-v1-';

// Generate a secure key from a password
async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  // Convert password and salt to buffers
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);
  
  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw', 
    passwordBuffer,
    { name: 'PBKDF2' }, 
    false, 
    ['deriveKey']
  );
  
  // Derive a key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate a random initialization vector
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Encrypt a string
export async function encryptString(text: string, password: string = 'default-app-key'): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Derive key from password
    const key = await deriveKey(password, MASTER_KEY_SALT);
    
    // Generate random IV
    const iv = generateIV();
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine IV and encrypted data and convert to Base64
    const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
    combinedData.set(iv);
    combinedData.set(new Uint8Array(encryptedData), iv.length);
    
    return arrayBufferToBase64(combinedData.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt a string
export async function decryptString(encryptedText: string, password: string = 'default-app-key'): Promise<string> {
  try {
    // Convert Base64 to ArrayBuffer
    const combinedData = base64ToArrayBuffer(encryptedText);
    
    // Extract IV and encrypted data
    const iv = new Uint8Array(combinedData, 0, 12);
    const encryptedData = new Uint8Array(combinedData, 12);
    
    // Derive key from password
    const key = await deriveKey(password, MASTER_KEY_SALT);
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    // Convert decrypted data to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Store an API key securely
export async function storeApiKey(provider: string, apiKey: string): Promise<void> {
  if (!apiKey) return;
  
  try {
    const encryptedKey = await encryptString(apiKey);
    localStorage.setItem(`${API_KEY_PREFIX}${provider}`, encryptedKey);
  } catch (error) {
    console.error(`Error storing API key for ${provider}:`, error);
    throw new Error(`Failed to store API key for ${provider}`);
  }
}

// Retrieve an API key
export async function getStoredApiKey(provider: string): Promise<string | null> {
  try {
    const encryptedKey = localStorage.getItem(`${API_KEY_PREFIX}${provider}`);
    if (!encryptedKey) return null;
    
    return await decryptString(encryptedKey);
  } catch (error) {
    console.error(`Error retrieving API key for ${provider}:`, error);
    return null;
  }
}

// Remove an API key
export function removeApiKey(provider: string): void {
  localStorage.removeItem(`${API_KEY_PREFIX}${provider}`);
}

// Clear all stored API keys
export function clearAllApiKeys(): void {
  Object.keys(localStorage)
    .filter(key => key.startsWith(API_KEY_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}

// Validate if a string looks like a valid API key format
export function validateApiKeyFormat(provider: string, apiKey: string): boolean {
  if (!apiKey) return false;
  
  // Provider-specific validation
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'claude':
      return apiKey.length > 20;
    case 'google':
      return apiKey.length > 20;
    default:
      return apiKey.length > 8; // Generic validation
  }
}

// Securely export all API keys (for backup/transfer)
export async function exportApiKeys(password: string): Promise<string> {
  const keys: Record<string, string> = {};
  
  // Collect all API keys
  const apiKeyEntries = Object.entries(localStorage)
    .filter(([key]) => key.startsWith(API_KEY_PREFIX));
  
  for (const [key, value] of apiKeyEntries) {
    const provider = key.replace(API_KEY_PREFIX, '');
    try {
      const decryptedKey = await decryptString(value);
      keys[provider] = decryptedKey;
    } catch (error) {
      console.error(`Error decrypting key for ${provider}:`, error);
    }
  }
  
  // Encrypt the entire collection with the provided password
  const keysJson = JSON.stringify(keys);
  return encryptString(keysJson, password);
}

// Import API keys from an encrypted export
export async function importApiKeys(encryptedData: string, password: string): Promise<void> {
  try {
    // Decrypt the data
    const keysJson = await decryptString(encryptedData, password);
    const keys = JSON.parse(keysJson);
    
    // Store each key
    for (const [provider, apiKey] of Object.entries(keys)) {
      await storeApiKey(provider, apiKey as string);
    }
  } catch (error) {
    console.error('Error importing API keys:', error);
    throw new Error('Failed to import API keys. The password may be incorrect.');
  }
}
