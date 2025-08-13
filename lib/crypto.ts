
// A simple encryption/decryption utility
// In production, use a more robust encryption library

// Generate a random encryption key
export function generateEncryptionKey(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Encrypt text with a key
export async function encrypt(text: string, key: string): Promise<string> {
  // Convert the key to a format usable by the Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Generate a random initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encodedText = encoder.encode(text);
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedText
  );
  
  // Combine the IV and encrypted data
  const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
  encryptedArray.set(iv);
  encryptedArray.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...encryptedArray));
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
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Convert from base64 and extract IV and encrypted data
    const encryptedArray = new Uint8Array(
      atob(encryptedText).split('').map(char => char.charCodeAt(0))
    );
    const iv = encryptedArray.slice(0, 12);
    const encryptedData = encryptedArray.slice(12);
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encryptedData
    );
    
    // Convert the decrypted data to text
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data. Invalid key or corrupted data.');
  }
}

// For secure API key encryption, use the secure-storage module instead
// These legacy functions are kept for backward compatibility but deprecated

/**
 * @deprecated Use secure-storage module functions instead
 */
export function encryptApiKey(apiKey: string): string {
  console.warn('encryptApiKey is deprecated. Use secure-storage module instead.');
  return apiKey; // Return plain text as fallback
}

/**
 * @deprecated Use secure-storage module functions instead  
 */
export function decryptApiKey(encryptedApiKey: string): string {
  console.warn('decryptApiKey is deprecated. Use secure-storage module instead.');
  return encryptedApiKey; // Return as-is as fallback
}
