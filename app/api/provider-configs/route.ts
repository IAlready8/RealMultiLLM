
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import {
  storeUserApiKey,
  getUserProviderConfigs,
  updateProviderSettings,
} from '@/lib/api-key-service';
import { badRequest, internalError, unauthorized } from '@/lib/http';
import logger from '@/lib/logger';

const validProviders = [
  'openai',
  'anthropic',
  'claude',
  'google',
  'google-ai',
  'openrouter',
  'github',
  'llama',
  'grok',
] as const;

// Schema for creating/updating a full provider configuration
const providerConfigSchema = z.object({
  provider: z.enum(validProviders),
  apiKey: z.string().min(1, 'API key is required'),
  settings: z.record(z.unknown()).optional(), // Allows any JSON object for settings
});

// Schema for updating only the settings of a provider
const providerSettingsSchema = z.object({
  provider: z.enum(validProviders),
  settings: z.record(z.unknown()).min(1, 'Settings object cannot be empty'),
});

// GET /api/provider-configs - Get all provider configurations for the user
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const configs = await getUserProviderConfigs(session.user.id);
    return NextResponse.json({ configs });
  } catch (error: any) {
    logger.error('Failed to fetch provider configurations', { 
      userId: session.user.id, 
      error: error.message 
    });
    return internalError('Failed to fetch provider configurations');
  }
}

// POST /api/provider-configs - Store or update a provider configuration
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { provider, apiKey, settings } = providerConfigSchema.parse(body);

    const config = await storeUserApiKey(
      session.user.id,
      provider,
      apiKey,
      settings
    );

    logger.info('Provider config stored', {
      userId: session.user.id,
      provider: provider,
    });

    return NextResponse.json({ config });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid configuration data', { details: error.issues });
    }
    logger.error('Failed to store provider configuration', {
      userId: session.user.id,
      error: error.message,
    });
    return internalError('Failed to store provider configuration');
  }
}

// PUT /api/provider-configs - Update provider settings only
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { provider, settings } = providerSettingsSchema.parse(body);

    const config = await updateProviderSettings(
      session.user.id,
      provider,
      settings
    );

    if (!config) {
      return NextResponse.json(
        { error: 'Provider configuration not found' },
        { status: 404 }
      );
    }

    logger.info('Provider settings updated', {
      userId: session.user.id,
      provider: provider,
    });

    return NextResponse.json({ config });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid settings data', { details: error.issues });
    }
    logger.error('Failed to update provider settings', {
      userId: session.user.id,
      error: error.message,
    });
    return internalError('Failed to update provider settings');
  }
}
