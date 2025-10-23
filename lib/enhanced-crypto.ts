/**
 * Enhanced crypto utilities with better error handling and validation
 */

/**
 * Derive a key from a password using PBKDF2
 */
export async function deriveKey(password: string): Promise<Uint8Array> {
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  try {
    // Encode the password as a buffer
    const encoder = new TextEncoder();
    const pwdBuffer = encoder.encode(password);

    // Create a key from the password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pwdBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive the key
    const salt = crypto.getRandomValues(new Uint8Array(16)); // 128-bit salt
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Export the key to get the raw bytes
    const exportedKey = await crypto.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(exportedKey);
  } catch (error) {
    throw new Error(`Failed to derive key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Enhanced AES-GCM encryption with better error handling
 */
export async function aesGcmEncrypt(key: Uint8Array, data: string): Promise<string> {
  if (!key || key.length === 0) {
    throw new Error('Encryption key is required and must be non-empty');
  }

  if (!data || typeof data !== 'string') {
    throw new Error('Data to encrypt must be a non-empty string');
  }

  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate a random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64 string
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Enhanced AES-GCM decryption with better error handling
 */
export async function aesGcmDecrypt(key: Uint8Array, encryptedData: string): Promise<string> {
  if (!key || key.length === 0) {
    throw new Error('Decryption key is required and must be non-empty');
  }

  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a non-empty string');
  }

  try {
    // Decode from base64
    const rawData = atob(encryptedData);
    const dataBuffer = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      dataBuffer[i] = rawData.charCodeAt(i);
    }

    // Extract IV (first 12 bytes) and encrypted data
    const iv = dataBuffer.slice(0, 12);
    const encryptedBytes = dataBuffer.slice(12);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      encryptedBytes
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication failed')) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
    
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureRandomString(length: number): string {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new Error('Length must be a positive integer');
  }

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  // Convert to base64 and remove any padding
  return btoa(String.fromCharCode(...array)).replace(/=/g, '');
}

/**
 * Hash data using SHA-256
 */
export async function sha256Hash(data: string): Promise<string> {
  if (!data) {
    throw new Error('Data to hash must be provided');
  }

  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw new Error(`Hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}