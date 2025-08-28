
import { encrypt, decrypt, generateEncryptionKey } from './crypto';

// Get or create a device-specific encryption key
function getDeviceKey(): string {
  let deviceKey = localStorage.getItem('device_encryption_key');
  if (!deviceKey) {
    deviceKey = generateEncryptionKey();
    localStorage.setItem('device_encryption_key', deviceKey);
  }
  return deviceKey;
}

// Securely store a value
export async function secureStore(key: string, value: string): Promise<void> {
  try {
    const deviceKey = getDeviceKey();
    const encrypted = await encrypt(value, deviceKey);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('Error storing data securely:', error);
    throw new Error('Failed to securely store data');
  }
}

// Securely retrieve a value
export async function secureRetrieve(key: string): Promise<string | null> {
  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    // If the data doesn't look encrypted (no proper base64 format), 
    // it might be stored as plain text - return it directly and re-encrypt it
    if (!encrypted.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      // Re-encrypt the plain text data for security
      const deviceKey = getDeviceKey();
      const encryptedValue = await encrypt(encrypted, deviceKey);
      localStorage.setItem(key, encryptedValue);
      return encrypted;
    }
    
    const deviceKey = getDeviceKey();
    return await decrypt(encrypted, deviceKey);
  } catch (error) {
    console.error('Error retrieving secure data:', error);
    // If decryption fails, try to return the raw value as fallback
    // This handles cases where data was stored before encryption was implemented
    const rawValue = localStorage.getItem(key);
    if (rawValue && !rawValue.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      return rawValue;
    }
    return null;
  }
}

// Securely remove a value
export function secureRemove(key: string): void {
  localStorage.removeItem(key);
}

// Export data with a password
export async function exportSecureData(password: string): Promise<string> {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('apiKey_') || 
      key === 'modelSettings'
    );
    
    const data: Record<string, string> = {};
    for (const key of keys) {
      data[key] = localStorage.getItem(key) || '';
    }
    
    const jsonData = JSON.stringify(data);
    const encrypted = await encrypt(jsonData, password);
    
    return encrypted;
  } catch (error) {
    console.error('Error exporting secure data:', error);
    throw new Error('Failed to export data');
  }
}

// Import data with a password
export async function importSecureData(encryptedData: string, password: string): Promise<void> {
  try {
    const jsonData = await decrypt(encryptedData, password);
    const data = JSON.parse(jsonData);
    
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value as string);
    }
  } catch (error) {
    console.error('Error importing secure data:', error);
    throw new Error('Failed to import data. Invalid password or corrupted data.');
  }
}
