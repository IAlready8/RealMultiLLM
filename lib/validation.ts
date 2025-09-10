// Validation schemas and utilities
import { z } from 'zod';

// Define validation schemas using Zod
export const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
  })).min(1),
  provider: z.string().min(1),
  options: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().optional(),
    systemPrompt: z.string().optional(),
  }).optional(),
});

export const AnalyticsRequestSchema = z.object({
  timeRange: z.string().optional(),
  predictions: z.boolean().optional(),
  anomalies: z.boolean().optional(),
});

// Type inference from schemas
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AnalyticsRequest = z.infer<typeof AnalyticsRequestSchema>;

// Validation result type
export interface ValidationResult<T> {
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
}