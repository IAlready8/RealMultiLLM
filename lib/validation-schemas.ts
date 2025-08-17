import { z } from 'zod';

// Message validation
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(50000)
});

// Chat request validation
export const ChatRequestSchema = z.object({
  provider: z.enum(['openai', 'claude', 'google', 'groq', 'ollama']),
  messages: z.array(MessageSchema).min(1).max(100),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(8192).optional(),
    model: z.string().max(100).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional()
  }).optional()
});

// Persona validation
export const PersonaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  systemPrompt: z.string().max(2000),
  avatar: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

// API key validation
export const ApiKeySchema = z.object({
  provider: z.enum(['openai', 'claude', 'google', 'groq', 'ollama']),
  apiKey: z.string().min(8).max(200)
});

// Settings validation
export const SettingsSchema = z.object({
  defaultProvider: z.enum(['openai', 'claude', 'google', 'groq', 'ollama']).optional(),
  defaultModel: z.string().max(100).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  autoSave: z.boolean().optional(),
  enableAnalytics: z.boolean().optional()
});

// Conversation validation
export const ConversationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  messages: z.array(MessageSchema).max(1000),
  provider: z.enum(['openai', 'claude', 'google', 'groq', 'ollama']),
  model: z.string().max(100).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  archived: z.boolean().optional()
});

// Export/Import validation
export const ExportDataSchema = z.object({
  conversations: z.array(ConversationSchema).optional(),
  personas: z.array(PersonaSchema).optional(),
  settings: SettingsSchema.optional(),
  exportDate: z.string().datetime(),
  version: z.string()
});

// Validation helper functions
export function validateChatRequest(data: unknown) {
  return ChatRequestSchema.parse(data);
}

export function validatePersona(data: unknown) {
  return PersonaSchema.parse(data);
}

export function validateApiKey(data: unknown) {
  return ApiKeySchema.parse(data);
}

export function validateSettings(data: unknown) {
  return SettingsSchema.parse(data);
}

export function validateConversation(data: unknown) {
  return ConversationSchema.parse(data);
}

export function validateExportData(data: unknown) {
  return ExportDataSchema.parse(data);
}

// Generic validation error handler
export function handleValidationError(error: z.ZodError) {
  const issues = error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
  
  return {
    error: 'Validation failed',
    issues
  };
}