// app/api/config/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deriveKey, aesGcmEncrypt } from '@/lib/crypto';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log(JSON.stringify({ level: 'info', message: 'API Key POST request received', userId: session?.user?.id, method: req.method, path: req.url }));

    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || typeof provider !== 'string' || typeof apiKey !== 'string') {
      return new NextResponse(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
    }

    // If API key is empty, it's a request to delete
    if (apiKey === '') {
      await prisma.providerConfig.deleteMany({
        where: {
          userId: session.user.id,
          provider: provider,
        },
      });
      console.log(JSON.stringify({ level: 'info', message: 'API Key deleted successfully', userId: session.user.id, provider: provider }));
      return new NextResponse(JSON.stringify({ success: true, action: 'deleted' }), { status: 200 });
    }

    const secret = process.env.SECURE_STORAGE_SECRET;
    if (!secret) {
      console.error('SECURE_STORAGE_SECRET is not set. Cannot save API key.');
      return new NextResponse(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
    }

    // Derive a user-specific key for encryption
    const encryptionKey = await deriveKey(`${secret}:${session.user.id}`);
    const encryptedApiKey = await aesGcmEncrypt(encryptionKey, apiKey);

    await prisma.providerConfig.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: provider,
        },
      },
      update: {
        apiKey: encryptedApiKey,
      },
      create: {
        userId: session.user.id,
        provider: provider,
        apiKey: encryptedApiKey,
      },
    });

    console.log(JSON.stringify({ level: 'info', message: 'API Key saved successfully', userId: session.user.id, provider: provider }));
    return new NextResponse(JSON.stringify({ success: true, action: 'saved' }), { status: 200 });
  } catch (error: any) {
    console.error('Error saving API key:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log(JSON.stringify({ level: 'info', message: 'API Key GET request received', userId: session?.user?.id, method: req.method, path: req.url }));

    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ configuredProviders: [] }), { status: 200 });
    }

    const providerConfigs = await prisma.providerConfig.findMany({
      where: {
        userId: session.user.id,
        apiKey: {
          not: null,
        },
      },
      select: {
        provider: true,
      },
    });

    const configuredProviders = providerConfigs.map(p => p.provider);

    console.log(JSON.stringify({ level: 'info', message: 'Configured providers fetched successfully', userId: session.user.id, count: configuredProviders.length }));
    return new NextResponse(JSON.stringify({ configuredProviders }), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching provider configs:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}