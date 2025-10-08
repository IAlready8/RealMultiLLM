/**
 * Two-Factor Authentication (2FA) with TOTP
 * Time-based One-Time Password implementation for enhanced security
 */

import * as crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Generate TOTP secret for user
 */
export function generateTOTPSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Generate TOTP code from secret
 */
export function generateTOTPCode(secret: string, window: number = 0): string {
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30) + window; // 30-second window

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));

  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify TOTP code
 */
export function verifyTOTPCode(
  secret: string,
  code: string,
  window: number = 1
): boolean {
  // Check current time and ±window periods (default ±30s)
  for (let i = -window; i <= window; i++) {
    const validCode = generateTOTPCode(secret, i);
    if (validCode === code) {
      return true;
    }
  }
  return false;
}

/**
 * Generate QR code URI for authenticator apps
 */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = 'RealMultiLLM'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  const encodedSecret = Buffer.from(secret, 'hex').toString('base32');

  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Enable 2FA for user
 */
export async function enableTwoFactor(
  userId: string,
  secret: string
): Promise<{ success: boolean; backupCodes: string[] }> {
  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  // Hash backup codes for storage
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(async (code) => {
      const bcrypt = await import('bcryptjs');
      return bcrypt.hash(code, 10);
    })
  );

  // Store in database
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
    },
  });

  return { success: true, backupCodes };
}

/**
 * Disable 2FA for user
 */
export async function disableTwoFactor(userId: string): Promise<boolean> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
    },
  });

  return true;
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorBackupCodes: true },
  });

  if (!user || !user.twoFactorBackupCodes) {
    return false;
  }

  const bcrypt = await import('bcryptjs');
  const hashedCodes = JSON.parse(user.twoFactorBackupCodes);

  // Check each backup code
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await bcrypt.compare(code, hashedCodes[i]);
    if (isValid) {
      // Remove used backup code
      hashedCodes.splice(i, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: JSON.stringify(hashedCodes) },
      });
      return true;
    }
  }

  return false;
}

/**
 * Check if user requires 2FA
 */
export async function requiresTwoFactor(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, role: true },
  });

  if (!user) return false;

  // Require 2FA for admin roles
  const adminRoles = ['super-admin', 'admin', 'user-manager'];
  return user.twoFactorEnabled === true || adminRoles.includes(user.role);
}

/**
 * Validate 2FA code during sign-in
 */
export async function validate2FACode(
  userId: string,
  code: string
): Promise<{ valid: boolean; method: 'totp' | 'backup' | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return { valid: false, method: null };
  }

  // Try TOTP first
  if (verifyTOTPCode(user.twoFactorSecret, code)) {
    return { valid: true, method: 'totp' };
  }

  // Try backup codes
  if (await verifyBackupCode(userId, code)) {
    return { valid: true, method: 'backup' };
  }

  return { valid: false, method: null };
}
