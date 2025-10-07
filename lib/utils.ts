
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Check if the connection is secure (HTTPS)
 * @param headers - Request headers object
 * @param isHttps - Direct HTTPS connection flag
 * @returns true if connection is secure
 */
export function isSecureConnection(
  headers: Record<string, string> = {},
  isHttps: boolean = false
): boolean {
  // Check if using HTTPS directly
  if (isHttps) {
    return true;
  }
  
  // Check x-forwarded-proto header (set by reverse proxies)
  const forwardedProto = headers['x-forwarded-proto'];
  if (forwardedProto === 'https') {
    return true;
  }
  
  return false;
}

/**
 * Sanitize user input to prevent XSS attacks
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove dangerous script tags and event handlers
  let sanitized = input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  // Preserve safe HTML tags like <em>, <strong>, <p>, etc.
  // This is a simple implementation - for production use a library like DOMPurify
  return sanitized;
}

/**
 * Validate persona data structure
 * @param data - Persona data object
 * @returns true if valid
 */
export function validatePersonaData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const { name, description, instructions } = data;
  
  // Check required fields
  if (!name || !description || !instructions) {
    return false;
  }
  
  // Check types
  if (typeof name !== 'string' || typeof description !== 'string' || typeof instructions !== 'string') {
    return false;
  }
  
  // Check lengths
  if (name.length === 0 || name.length > 100) {
    return false;
  }
  
  if (description.length === 0 || description.length > 500) {
    return false;
  }
  
  if (instructions.length === 0 || instructions.length > 10000) {
    return false;
  }
  
  return true;
}
