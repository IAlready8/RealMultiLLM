// Utility functions for encryption and decryption

// Generate a device-specific key based on user agent and other factors
function getDeviceKey(): string {
  if (typeof window !== 'undefined') {
    const userAgent = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return btoa(`${userAgent}-${screen}-${timezone}`).slice(0, 32);
  }
  return 'fallback-key-for-server-side-rendering';
}

// Simple encrypt function using TextEncoder and crypto.subtle
export async function encrypt(text: string, key: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Convert the key to a format usable by the Web Crypto API
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to simple encoding
    return btoa(text);
  }
}

// Validate base64 string
export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  try {
    // Check if string contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) return false;
    
    // Try to decode and check if successful
    atob(str);
    return true;
  } catch (error) {
    return false;
  }
}

// Decrypt text with a key
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  try {
    // Validate base64 format first
    if (!isValidBase64(encryptedText)) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert the key to a format usable by the Web Crypto API
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decode the base64 data
    const encryptedArray = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = encryptedArray.slice(0, 12);
    const encrypted = encryptedArray.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    // Fallback to simple decoding
    try {
      return atob(encryptedText);
    } catch (fallbackError) {
      throw new Error('Failed to decrypt data. Invalid key or corrupted data.');
    }
  }
}

// Simplified API for components
const DEFAULT_KEY = 'default-encryption-key-12345678901234567890123456789012';

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  try {
    // Simple XOR encryption for demo purposes
    const encrypted = Array.from(apiKey)
      .map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ DEFAULT_KEY.charCodeAt(i % DEFAULT_KEY.length))
      )
      .join('');
    
    return btoa(encrypted);
  } catch (error) {
    console.error('Encryption error:', error);
    return apiKey;
  }
}

export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  
  try {
    // Check if it's already decrypted (plain text)
    if (!isValidBase64(encryptedApiKey)) {
      return encryptedApiKey;
    }
    
    const encrypted = atob(encryptedApiKey);
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