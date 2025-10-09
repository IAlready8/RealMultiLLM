import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sanitizeInput as baseSanitizeInput } from './security';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitRecord>();

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export async function rateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000
): Promise<boolean> {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (existing.count < maxRequests) {
    existing.count += 1;
    return true;
  }

  return false;
}

export function sanitizeInput(input: string): string {
  return baseSanitizeInput(input);
}

interface PersonaCandidate {
  name?: unknown;
  description?: unknown;
  instructions?: unknown;
}

export function validatePersonaData(candidate: PersonaCandidate | null | undefined): boolean {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const { name, description, instructions } = candidate;

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return false;
  }

  if (
    typeof description !== 'string' ||
    description.trim().length === 0 ||
    description.trim().length > 500
  ) {
    return false;
  }

  if (
    typeof instructions !== 'string' ||
    instructions.trim().length === 0 ||
    instructions.trim().length > 4000
  ) {
    return false;
  }

  return true;
}

type HeaderRecord = Record<string, string | undefined>;

export function isSecureConnection(
  headers: HeaderRecord,
  isHttpsConnection: boolean
): boolean {
  const forwardedProto =
    headers['x-forwarded-proto'] ?? headers['X-Forwarded-Proto'] ?? headers['X_FORWARDED_PROTO'];

  if (forwardedProto) {
    const primaryProto = forwardedProto.split(',')[0]?.trim().toLowerCase();
    return primaryProto === 'https';
  }

  if (isHttpsConnection) {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}

export const isProduction = process.env.NODE_ENV === 'production';
