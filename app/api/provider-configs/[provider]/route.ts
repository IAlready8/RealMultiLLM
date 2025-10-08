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
import { deleteUserProviderConfig, hasValidApiKey } from '@/lib/api-key-service';
import { badRequest, internalError, unauthorized } from '@/lib/http';
import logger from '@/lib/logger';
import { configManager } from '@/lib/config-manager';
import { testProviderConnection, getProviderMetadata, hasProvider } from '@/services/llm-providers/registry';

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

// Schema to validate the dynamic route parameter
const routeContextSchema = z.object({
  provider: z.enum(validProviders),
});

// Validation schema for provider configuration
const providerConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional().or(z.literal('')),
  models: z.array(z.string()).optional(),
  rateLimits: z.object({
    requests: z.number().int().positive(),
    window: z.number().int().positive()
  }).optional(),
  isActive: z.boolean().optional().default(true),
  settings: z.record(z.any()).optional()
});

/**
 * GET /api/provider-configs/[provider]
 * Retrieve configuration for a specific provider
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(await params);

    // Fetch configuration
    const config = await configManager.getProviderConfig(session.user.id, provider);

    if (!config) {
      return NextResponse.json(
        {
          provider,
          configured: false,
          hasValidKey: false,
          message: `No configuration found for ${provider}`
        },
        { status: 404 }
      );
    }

    // Never expose raw API key in response
    const sanitizedConfig = {
      provider,
      configured: true,
      hasValidKey: Boolean(config.apiKey && config.apiKey.length > 0),
      isActive: config.isActive,
      baseUrl: config.baseUrl || null,
      models: config.models || [],
      rateLimits: config.rateLimits,
      settings: config.settings || {}
    };

    return NextResponse.json(sanitizedConfig, { status: 200 });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }
    logger.error('Failed to check provider configuration status', {
      userId: session.user.id,
      provider: (await params).provider,
      error: error.message,
    });
    return internalError('Failed to check provider configuration status');
  }
}

/**
 * POST /api/provider-configs/[provider]
 * Create new provider configuration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(await params);

    // Parse and validate request body
    const body = await request.json();
    const validation = providerConfigSchema.safeParse(body);

    if (!validation.success) {
      return badRequest('Invalid configuration data', { details: validation.error.format() });
    }

    const configData = validation.data;

    // Test connection before persisting (optional but recommended)
    if (configData.apiKey && hasProvider(provider)) {
      const testResult = await testProviderConnection(
        provider,
        configData.apiKey,
        configData.baseUrl
      );

      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'Connection Test Failed',
            message: testResult.error || 'Unable to connect with provided credentials',
            tested: true
          },
          { status: 400 }
        );
      }
    }

    // Create configuration
    const result = await configManager.updateProviderConfig(
      session.user.id,
      provider,
      {
        apiKey: configData.apiKey,
        baseUrl: configData.baseUrl,
        models: configData.models,
        rateLimits: configData.rateLimits,
        isActive: configData.isActive,
        settings: configData.settings
      }
    );

    if (!result.success) {
      return internalError('Failed to save configuration');
    }

    logger.info('Provider config created', {
      userId: session.user.id,
      provider: provider,
    });

    return NextResponse.json(
      {
        success: true,
        provider,
        message: 'Configuration created successfully',
        warnings: result.warnings
      },
      { status: 201 }
    );

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }
    logger.error('Failed to create provider configuration', {
      userId: session.user.id,
      provider: (await params).provider,
      error: error.message,
    });
    return internalError('Failed to create provider configuration');
  }
}

/**
 * PUT /api/provider-configs/[provider]
 * Update existing provider configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(await params);

    // Parse request body (partial update allowed)
    const body = await request.json();

    // Validate partial configuration
    const partialSchema = providerConfigSchema.partial();
    const validation = partialSchema.safeParse(body);

    if (!validation.success) {
      return badRequest('Invalid configuration data', { details: validation.error.format() });
    }

    const configData = validation.data;

    // If API key changed, test new connection
    if (configData.apiKey && hasProvider(provider)) {
      const testResult = await testProviderConnection(
        provider,
        configData.apiKey,
        configData.baseUrl
      );

      if (!testResult.success) {
        return NextResponse.json(
          {
            error: 'Connection Test Failed',
            message: testResult.error || 'Unable to connect with provided credentials',
            tested: true
          },
          { status: 400 }
        );
      }
    }

    // Update configuration
    const result = await configManager.updateProviderConfig(
      session.user.id,
      provider,
      configData as any
    );

    if (!result.success) {
      return internalError('Failed to update configuration');
    }

    logger.info('Provider config updated', {
      userId: session.user.id,
      provider: provider,
    });

    return NextResponse.json(
      {
        success: true,
        provider,
        message: 'Configuration updated successfully',
        warnings: result.warnings
      },
      { status: 200 }
    );

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }
    logger.error('Failed to update provider configuration', {
      userId: session.user.id,
      provider: (await params).provider,
      error: error.message,
    });
    return internalError('Failed to update provider configuration');
  }
}

/**
 * DELETE /api/provider-configs/[provider]
 * Remove provider configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(await params);

    await deleteUserProviderConfig(session.user.id, provider);

    logger.info('Provider config deleted', {
      userId: session.user.id,
      provider: provider,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }
    logger.error('Failed to delete provider configuration', {
      userId: session.user.id,
      provider: (await params).provider,
      error: error.message,
    });
    return internalError('Failed to delete provider configuration');
  }
}
