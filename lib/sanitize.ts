import DOMPurify from 'dompurify';

// Configure DOMPurify for our use case
const config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  USE_PROFILES: { html: true }
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  
  // Only sanitize if running in browser
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(dirty, config);
  }
  
  // Server-side: basic text cleaning
  return dirty
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitize user input for display in UI
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .substring(0, 10000) // Limit length
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:/gi, ''); // Remove data: protocols
}

/**
 * Sanitize persona names and descriptions
 */
export function sanitizePersonaData(data: { name?: string; description?: string }) {
  return {
    name: data.name ? sanitizeUserInput(data.name).substring(0, 100) : '',
    description: data.description ? sanitizeUserInput(data.description).substring(0, 1000) : ''
  };
}

/**
 * Sanitize chat messages
 */
export function sanitizeChatMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  return message
    .trim()
    .substring(0, 50000) // Maximum message length
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript protocols
    .replace(/data:text\/html/gi, ''); // Remove HTML data URLs
}

/**
 * Validate and sanitize API keys
 */
export function sanitizeApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '';
  }
  
  // Remove any HTML tags, whitespace, and limit length
  return apiKey
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 200);
}