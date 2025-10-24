import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

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

// Schema for future validation if needed
const _providerSchema = z.object({
  provider: z.enum(validProviders),
});

const configSchema = z.object({
  provider: z.enum(validProviders),
  apiKey: z.string().min(1, 'API key is required'),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/provider-config - Get all provider configurations for the user
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Directly fetch using Prisma to get all required fields
    const prisma = (await import('@/lib/prisma')).default;
    
    const dbConfigs = await prisma.providerConfig.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        provider: true,
        isActive: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
        apiKey: true, // Needed to determine hasApiKey
      },
    });

    // Transform the configs to match the ProviderConfig interface expected by the hook
    const transformedConfigs = dbConfigs.map(config => ({
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      usageCount: config.usageCount,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      hasApiKey: !!config.apiKey, // Check if apiKey exists and is not null
    }));
    
    return NextResponse.json({ configs: transformedConfigs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error fetching provider configurations';
    console.error('Failed to fetch provider configurations', { 
      userId: session.user.id, 
      error: message 
    });
    return NextResponse.json(
      { error: 'Failed to fetch provider configurations' }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/provider-config - Store or update a provider configuration
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, apiKey } = configSchema.parse(body);
    const { settings } = body; // Settings is optional, so parse separately

    // Directly create/update using Prisma
    const prisma = (await import('@/lib/prisma')).default;
    
    // Encrypt the API key
    const { deriveKey, aesGcmEncrypt } = await import('@/lib/crypto');
    const seed = process.env.API_KEY_ENCRYPTION_SEED || 'default-encryption-seed-change-in-production';
    const encryptionKey = await deriveKey(seed);
    const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey);

    // Create or update the provider configuration
    const config = await prisma.providerConfig.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: provider,
        },
      },
      update: {
        apiKey: encryptedApiKey,
        settings: settings ? JSON.stringify(settings) : null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        provider: provider,
        apiKey: encryptedApiKey,
        settings: settings ? JSON.stringify(settings) : null,
        isActive: true,
      },
    });

    // Transform the returned config to match the expected interface
    const transformedConfig = {
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      usageCount: config.usageCount,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      hasApiKey: !!config.apiKey, // Check if apiKey exists and is not null
    };

    return NextResponse.json({ config: transformedConfig });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration data', details: error.issues }, 
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error storing provider configuration';
    console.error('Failed to store provider configuration', {
      userId: session.user.id,
      error: message,
    });
    return NextResponse.json(
      { error: 'Failed to store provider configuration' }, 
      { status: 500 }
    );
  }
}

/**
 * PUT /api/provider-config - Update provider configuration
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const configId = url.searchParams.get('configId');
    
    if (!configId) {
      return NextResponse.json({ error: 'configId is required' }, { status: 400 });
    }

    const body = await request.json();
    const { apiKey, settings, isActive } = body;

    // Directly update using Prisma since we need to update by configId
    const prisma = (await import('@/lib/prisma')).default;
    
    // Check if the config exists and belongs to the user
    const existingConfig = await prisma.providerConfig.findFirst({
      where: {
        id: configId,
        userId: session.user.id,
      },
    });
    
    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Provider configuration not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (apiKey !== undefined) {
      // If an API key is provided, encrypt it
      if (apiKey) {
        const { deriveKey, aesGcmEncrypt } = await import('@/lib/crypto');
        const seed = process.env.API_KEY_ENCRYPTION_SEED || 'default-encryption-seed-change-in-production';
        const encryptionKey = await deriveKey(seed);
        updateData.apiKey = await aesGcmEncrypt(encryptionKey, apiKey);
      } else {
        // If empty API key, set to null (effectively deleting it)
        updateData.apiKey = null;
      }
    }

    if (settings !== undefined) {
      updateData.settings = JSON.stringify(settings);
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update the provider configuration
    const updatedConfig = await prisma.providerConfig.update({
      where: {
        id: configId,
      },
      data: updateData,
    });

    // Transform the returned config to match the expected interface
    const transformedConfig = {
      id: updatedConfig.id,
      provider: updatedConfig.provider,
      isActive: updatedConfig.isActive,
      usageCount: updatedConfig.usageCount,
      createdAt: updatedConfig.createdAt,
      updatedAt: updatedConfig.updatedAt,
      hasApiKey: !!updatedConfig.apiKey,
    };

    return NextResponse.json({ config: transformedConfig });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration data', details: error.issues }, 
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error updating provider configuration';
    console.error('Failed to update provider configuration', {
      userId: session.user.id,
      error: message,
    });
    return NextResponse.json(
      { error: 'Failed to update provider configuration' }, 
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/provider-config - Delete provider configuration
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const configId = url.searchParams.get('configId');
    
    if (!configId) {
      return NextResponse.json({ error: 'configId is required' }, { status: 400 });
    }

    // Directly delete using Prisma since we need to delete by configId
    const prisma = (await import('@/lib/prisma')).default;
    
    // Check if the config exists and belongs to the user
    const existingConfig = await prisma.providerConfig.findFirst({
      where: {
        id: configId,
        userId: session.user.id,
      },
    });
    
    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Provider configuration not found' },
        { status: 404 }
      );
    }
    
    // Delete the provider configuration
    await prisma.providerConfig.delete({
      where: {
        id: configId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const _message = error instanceof Error ? error.message : 'Unknown error deleting provider configuration';
    
    return NextResponse.json(
      { error: 'Failed to delete provider configuration' }, 
      { status: 500 }
    );
  }
}