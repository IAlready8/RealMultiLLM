import crypto from 'crypto'

// Encryption key should be stored in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'

export function encryptApiKey(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

export function decryptApiKey(encryptedText: string): string {
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format')
  }
  
  const _iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// For development, we'll use a simple reversible encoding
// In production, use proper encryption with environment variables
export function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64')
}

export function simpleDecrypt(encryptedText: string): string {
  return Buffer.from(encryptedText, 'base64').toString('utf8')
}

export function generateSecureHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function generateApiKey(): string {
  const keyId = crypto.randomBytes(16).toString('hex')
  const keySecret = crypto.randomBytes(32).toString('hex')
  return `rml_${keyId}_${keySecret}`
}

export function validateApiKeyFormat(apiKey: string): boolean {
  return /^rml_[a-f0-9]{32}_[a-f0-9]{64}$/.test(apiKey)
}