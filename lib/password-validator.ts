import { z } from 'zod';
import { isProduction } from './env';

/**
 * Enterprise-grade password validation and security utilities
 * Implements NIST guidelines and industry best practices
 */

export interface PasswordStrength {
  score: number; // 0-100
  level: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
  feedback: string[];
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
    noCommonPatterns: boolean;
    noPersonalInfo: boolean;
  };
}

// Common weak passwords and patterns (simplified list)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'root', 'user', 'test', 'guest', 'demo', '111111', '000000',
  'welcome', 'login', 'passw0rd', 'p@ssword', 'pa$word'
]);

// Common keyboard patterns
const KEYBOARD_PATTERNS = [
  'qwerty', 'asdf', 'zxcv', '1234', '!@#, 'qaz', 'wsx', 'edc'
];

// Sequential patterns
const SEQUENTIAL_PATTERNS = [
  '123', '234', '345', '456', '567', '678', '789', '890',
  'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij'
];

/**
 * Production password schema - enterprise grade requirements
 */
export const productionPasswordSchema = z.string()
  .min(14, "Password must be at least 14 characters long")
  .max(128, "Password must be no more than 128 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[@$!%*?&^#()_+={}\[\]:;<>.,~`]/, "Password must contain at least one special character")
  .refine(password => !hasCommonPatterns(password), "Password contains common patterns")
  .refine(password => !isCommonPassword(password), "Password is too common");

/**
 * Development password schema - relaxed for testing
 */
export const developmentPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be no more than 128 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[@$!%*?&^#()_+={}\[\]:;<>.,~`]/, "Password must contain at least one special character");

/**
 * Get appropriate password schema based on environment
 */
export function getPasswordSchema() {
  return isProduction() ? productionPasswordSchema : developmentPasswordSchema;
}

/**
 * Validate password strength and return detailed feedback
 */
export function validatePasswordStrength(
  password: string,
  personalInfo?: { name?: string; email?: string; username?: string }
): PasswordStrength {
  console.log(`Validating password: ${password}`);
  const requirements = {
    length: password.length >= (isProduction() ? 14 : 8),
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[@$!%*?&^#()_+={}\[\]:;<>.,~`]/.test(password),
    noCommonPatterns: !hasCommonPatterns(password),
    noPersonalInfo: !containsPersonalInfo(password, personalInfo)
  };

  const feedback: string[] = [];
  let score = 0;

  // Length scoring (30 points)
  if (requirements.length) {
    score += 20;
    if (password.length >= 16) score += 10;
  } else {
    feedback.push(`Password must be at least ${isProduction() ? 14 : 8} characters long`);
  }

  // Character diversity (40 points total)
  if (requirements.uppercase) score += 10;
  else feedback.push("Add uppercase letters");

  if (requirements.lowercase) score += 10;
  else feedback.push("Add lowercase letters");

  if (requirements.numbers) score += 10;
  else feedback.push("Add numbers");

  if (requirements.symbols) score += 10;
  else feedback.push("Add special characters");

  // Pattern analysis (20 points)
  if (requirements.noCommonPatterns) {
    score += 15;
  } else {
    feedback.push("Avoid common keyboard patterns and sequences");
  }

  // Personal info check (10 points)
  if (requirements.noPersonalInfo) {
    score += 5;
  } else {
    feedback.push("Don't use personal information in passwords");
  }

  // Entropy bonus (up to 10 points)
  const entropy = calculateEntropy(password);
  if (entropy > 60) score += 10;
  else if (entropy > 40) score += 5;

  // Determine strength level
  let level: PasswordStrength['level'];
  if (score >= 90) level = 'very_strong';
  else if (score >= 75) level = 'strong';
  else if (score >= 60) level = 'fair';
  else if (score >= 40) level = 'weak';
  else level = 'very_weak';

  // Add positive feedback for strong passwords
  if (score >= 75) {
    feedback.unshift("Strong password! Good job.");
  } else if (score >= 60) {
    feedback.unshift("Good password, but could be stronger.");
  }

  console.log(`Password: ${password}, Score: ${score}, Level: ${level}`);

  return {
    score: Math.min(100, score),
    level,
    feedback,
    requirements
  };
}

/**
 * Check if password contains common patterns
 */
function hasCommonPatterns(password: string): boolean {
  const lower = password.toLowerCase();
  
  // Check common passwords
  if (isCommonPassword(lower)) return true;
  
  // Check keyboard patterns
  for (const pattern of KEYBOARD_PATTERNS) {
    if (lower.includes(pattern) || lower.includes(pattern.split('').reverse().join(''))) {
      return true;
    }
  }
  
  // Check sequential patterns
  for (const pattern of SEQUENTIAL_PATTERNS) {
    if (lower.includes(pattern) || lower.includes(pattern.split('').reverse().join(''))) {
      return true;
    }
  }
  
  // Check repeated characters (more than 3 in a row)
  if (/(.)\1{3,}/.test(password)) return true;
  
  // Check simple substitutions (common l33t speak)
  const substituted = lower
    .replace(/[@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't');
    
  if (isCommonPassword(substituted)) return true;
  
  return false;
}

/**
 * Check if password is in common password list
 */
function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Check if password contains personal information
 */
function containsPersonalInfo(
  password: string,
  personalInfo?: { name?: string; email?: string; username?: string }
): boolean {
  if (!personalInfo) return false;
  
  const lower = password.toLowerCase();
  
  // Check name
  if (personalInfo.name) {
    const nameParts = personalInfo.name.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && lower.includes(part)) {
        return true;
      }
    }
  }
  
  // Check email parts
  if (personalInfo.email) {
    const emailParts = personalInfo.email.toLowerCase().split(/[@.]/);
    for (const part of emailParts) {
      if (part.length > 2 && lower.includes(part)) {
        return true;
      }
    }
  }
  
  // Check username
  if (personalInfo.username && personalInfo.username.length > 2) {
    if (lower.includes(personalInfo.username.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate password entropy (simplified estimation)
 */
function calculateEntropy(password: string): number {
  let charset = 0;
  
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/\d/.test(password)) charset += 10;
  if (/[@$!%*?&^#()_+={}\[\]:;<>.,~`]/.test(password)) charset += 32;
  
  // Add other special characters
  if (/[^a-zA-Z\d@$!%*?&^#()_+={}\[\]:;<>.,~`]/.test(password)) charset += 10;
  
  return Math.log2(Math.pow(charset, password.length));
}

/**
 * Generate a secure password suggestion
 */
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '@$!%*?&^#()_+={}<>.,~';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if password has been compromised (placeholder for future implementation)
 * This would integrate with services like HaveIBeenPwned API
 */
export async function checkPasswordBreach(password: string): Promise<{
  isCompromised: boolean;
  occurrences?: number;
}> {
  // For now, just check against our common passwords list
  // In production, this should integrate with breach databases
  const isCompromised = isCommonPassword(password);
  
  return {
    isCompromised,
    occurrences: isCompromised ? 1000 : 0
  };
}

/**
 * Rate limit password validation attempts to prevent brute force
 */
const validationAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function rateLimitPasswordValidation(identifier: string): boolean {
  const now = Date.now();
  const attempt = validationAttempts.get(identifier);
  
  if (!attempt) {
    validationAttempts.set(identifier, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset counter if more than 1 hour has passed
  if (now - attempt.lastAttempt > 3600000) {
    validationAttempts.set(identifier, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Allow up to 10 validation attempts per hour
  if (attempt.count < 10) {
    attempt.count++;
    attempt.lastAttempt = now;
    return true;
  }
  
  return false;
}