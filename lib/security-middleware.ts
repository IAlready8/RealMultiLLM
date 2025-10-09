import { sanitizeInput as baseSanitizeInput, validateApiKey as baseValidateApiKey } from './security';

export type SecurityHeaders = Record<string, string>;

export const securityHeaders: SecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export async function validateApiKey(apiKey: string): Promise<boolean> {
  return Promise.resolve(baseValidateApiKey(apiKey));
}

export function sanitizeInput(input: string): string {
  return baseSanitizeInput(input);
}
