/**
 * Provider Configuration API Routes
 *
 * Handles CRUD operations for provider-specific configurations.
 * Supports: GET (read), POST (create), PUT (update), DELETE (remove)
 *
 * Security: Session-based authentication, encrypted storage, rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { deleteUserProviderConfig } from '@/lib/api-key-service';
import { badRequest, internalError, unauthorized } from '@/lib/http';
import logger from '@/lib/logger';
import { configManager } from '@/lib/config-manager';
import { testProviderConnection, hasProvider } from '@/services/llm-providers/registry';

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

const routeContextSchema = z.object({
  provider: z.enum(validProviders),
});

const providerConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional().or(z.literal('')),
  models: z.array(z.string()).optional(),
  rateLimits: z.object({
    requests: z.number().int().positive(),
    window: z.number().int().positive(),
  }).optional(),
  isActive: z.boolean().optional().default(true),
  settings: z.record(z.string(), z.any()).optional(),
});

type ProviderConfigInput = z.infer<typeof providerConfigSchema>;

async function resolveProvider(params: Promise<{ provider: string }>): Promise<string> {
  const raw = await params;
  const parsed = routeContextSchema.parse(raw);
  return parsed.provider;
}

/**
 * GET /api/provider-configs/[provider]
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  let provider: string | null = null;
  try {
    provider = await resolveProvider(context.params);
    const config = await configManager.getProviderConfig(session.user.id, provider);

    if (!config) {
      return NextResponse.json(
        {
          provider,
          configured: false,
          hasValidKey: false,
          message: `No configuration found for ${provider}`,
        },
        { status: 404 },
      );
    }

    const sanitizedConfig = {
      provider,
      configured: true,
      hasValidKey: Boolean(config.apiKey && config.apiKey.length > 0),
      isActive: config.isActive,
      baseUrl: config.baseUrl || null,
      models: config.models || [],
      rateLimits: config.rateLimits,
      settings: config.settings || {},
    };

    return NextResponse.json(sanitizedConfig, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }

    const message = error instanceof Error ? error.message : 'Unknown error checking provider configuration status';
    logger.error('Failed to check provider configuration status', {
      userId: session.user.id,
      provider,
      error: message,
    });
    return internalError('Failed to check provider configuration status');
  }
}

/**
 * POST /api/provider-configs/[provider]
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  let provider: string | null = null;
  try {
    provider = await resolveProvider(context.params);

    const body = await request.json();
    const validation = providerConfigSchema.safeParse(body);

    if (!validation.success) {
      return badRequest('Invalid configuration data', { details: validation.error.format() });
    }

    const configData = validation.data;

    if (configData.apiKey && hasProvider(provider)) {
      const testResult = await testProviderConnection(provider, configData.apiKey, configData.baseUrl);
      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'Connection Test Failed',
            message: testResult.error || 'Unable to connect with provided credentials',
            tested: true,
          },
          { status: 400 },
        );
      }
    }

    const result = await configManager.updateProviderConfig(session.user.id, provider, {
      apiKey: configData.apiKey,
      baseUrl: configData.baseUrl || undefined,
      models: configData.models,
      rateLimits: configData.rateLimits,
      isActive: configData.isActive,
      settings: configData.settings,
    });

    if (!result.success) {
      return internalError('Failed to save configuration');
    }

    logger.info('Provider config created', {
      userId: session.user.id,
      provider,
    });

    return NextResponse.json(
      {
        success: true,
        provider,
        message: 'Configuration created successfully',
        warnings: result.warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }

    const message = error instanceof Error ? error.message : 'Unknown error creating provider configuration';
    logger.error('Failed to create provider configuration', {
      userId: session.user.id,
      provider,
      error: message,
    });
    return internalError('Failed to create provider configuration');
  }
}

/**
 * PUT /api/provider-configs/[provider]
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  let provider: string | null = null;
  try {
    provider = await resolveProvider(context.params);

    const body = await request.json();
    const partialSchema = providerConfigSchema.partial();
    const validation = partialSchema.safeParse(body);

    if (!validation.success) {
      return badRequest('Invalid configuration data', { details: validation.error.format() });
    }

    const configData = validation.data as Partial<ProviderConfigInput>;

    if (configData.apiKey && hasProvider(provider)) {
      const testResult = await testProviderConnection(provider, configData.apiKey, configData.baseUrl);
      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'Connection Test Failed',
            message: testResult.error || 'Unable to connect with provided credentials',
            tested: true,
          },
          { status: 400 },
        );
      }
    }

    const result = await configManager.updateProviderConfig(session.user.id, provider, {
      ...configData,
      baseUrl: configData.baseUrl || undefined,
    });

    if (!result.success) {
      return internalError('Failed to update configuration');
    }

    logger.info('Provider config updated', {
      userId: session.user.id,
      provider,
    });

    return NextResponse.json(
      {
        success: true,
        provider,
        message: 'Configuration updated successfully',
        warnings: result.warnings,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }

    const message = error instanceof Error ? error.message : 'Unknown error updating provider configuration';
    logger.error('Failed to update provider configuration', {
      userId: session.user.id,
      provider,
      error: message,
    });
    return internalError('Failed to update provider configuration');
  }
}

/**
 * DELETE /api/provider-configs/[provider]
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  let provider: string | null = null;
  try {
    provider = await resolveProvider(context.params);

    await deleteUserProviderConfig(session.user.id, provider);

    logger.info('Provider config deleted', {
      userId: session.user.id,
      provider,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }

    const message = error instanceof Error ? error.message : 'Unknown error deleting provider configuration';
    logger.error('Failed to delete provider configuration', {
      userId: session.user.id,
      provider,
      error: message,
    });
    return internalError('Failed to delete provider configuration');
  }
}
