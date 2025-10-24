// app/api/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { testProviderConnection, getProviderModels } from '@/lib/provider-tests';
import { z } from 'zod';

const CreateApiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'grok']),
  encryptedKey: z.string().min(1),
  keyName: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    // includeUsage could be used for future enhancement
    const _includeUsage = searchParams.get('includeUsage') === 'true';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: session.user.id };
    if (provider) {
      where.provider = provider;
    }

    const apiKeys = await prisma.providerConfig.findMany({
      where,
      select: {
        id: true,
        provider: true,
        settings: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        usageCount: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(apiKeys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreateApiKeySchema.parse(body);

    // Decrypt the key to test it
    const decryptedKey = decrypt(validated.encryptedKey);
    
    // Test the API key
    const isValid = await testProviderConnection(validated.provider, decryptedKey);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key or connection failed' },
        { status: 400 }
      );
    }

    // Check if key already exists for this provider
    const existingKey = await prisma.providerConfig.findFirst({
      where: {
        userId: session.user.id,
        provider: validated.provider,
        isActive: true
      }
    });

    if (existingKey) {
      return NextResponse.json(
        { error: 'An active API key already exists for this provider' },
        { status: 409 }
      );
    }

    // Get available models for this provider
    const models = await getProviderModels(validated.provider, decryptedKey);

    // Save to database
    const apiKey = await prisma.providerConfig.create({
      data: {
        provider: validated.provider,
        apiKey: encrypt(validated.encryptedKey),
        settings: JSON.stringify({ keyName: validated.keyName || `${validated.provider} Key`, availableModels: models }),
        userId: session.user.id
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_API_KEY',
        resource: `ApiKey:${apiKey.id}`,
        details: JSON.stringify({
          provider: validated.provider,
          keyName: validated.keyName
        })
      }
    });

    return NextResponse.json({
      id: apiKey.id,
      provider: apiKey.provider,
      settings: apiKey.settings,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to save API key:', error);
    return NextResponse.json(
      { error: 'Failed to save API key' },
      { status: 500 }
    );
  }
}