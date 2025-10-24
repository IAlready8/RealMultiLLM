import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

const ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_MASTER_KEY is not set');
}

function getKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

export function decrypt(encryptedText: string): string {
  const encryptedBuffer = Buffer.from(encryptedText, 'hex');
  const salt = encryptedBuffer.slice(0, SALT_LENGTH);
  const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = getKey(salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
