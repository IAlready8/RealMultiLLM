import { ZodSchema } from 'zod';
import { NextRequest } from 'next/server';
import { createApiError, ErrorCodes } from '@/lib/error-handler';

/**
 * Middleware function to validate API request bodies against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Middleware function that validates the request body
 */
export function withValidation(schema: ZodSchema) {
  return async function validate(req: Request) {
    try {
      // Clone the request to avoid consuming the body
      const clonedReq = req.clone();
      
      // Parse the request body
      const body = await clonedReq.json();
      
      // Validate the body against the schema
      const validatedData = schema.parse(body);
      
      // Add validated data to request object for use in route handlers
      (req as any).validatedData = validatedData;
      
      // Continue with the request
      return null;
    } catch (error: any) {
      // Return validation error response
      return Response.json(
        createApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid request data', error),
        { status: 400 }
      );
    }
  };
}

/**
 * Middleware function to validate query parameters against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Middleware function that validates the query parameters
 */
export function withQueryValidation(schema: ZodSchema) {
  return function validate(req: Request) {
    try {
      // Get query parameters from the request
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams);
      
      // Validate the query parameters against the schema
      const validatedData = schema.parse(queryParams);
      
      // Add validated data to request object for use in route handlers
      (req as any).validatedQuery = validatedData;
      
      // Continue with the request
      return null;
    } catch (error: any) {
      // Return validation error response
      return Response.json(
        createApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid query parameters', error),
        { status: 400 }
      );
    }
  };
}