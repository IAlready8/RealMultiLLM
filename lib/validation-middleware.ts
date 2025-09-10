// Validation middleware for API routes
import { ZodSchema } from 'zod';
import { ValidationResult } from '@/lib/validation';

/**
 * Higher-order function that creates validation middleware
 * @param schema - Zod schema to validate against
 * @returns Middleware function that validates request data
 */
export function withValidation<T>(schema: ZodSchema<T>) {
  return async function validate(data: any): Promise<ValidationResult<T>> {
    try {
      const parsed = schema.parse(data);
      return { data: parsed };
    } catch (error: any) {
      // Extract validation error details
      const fieldError = error.errors?.[0];
      return {
        error: {
          message: fieldError?.message || 'Validation failed',
          field: fieldError?.path?.join('.') || undefined
        }
      };
    }
  };
}