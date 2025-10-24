// app/api/api-keys/[id]/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { testProviderConnection } from '@/lib/provider-tests';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found or inactive' }, { status: 404 });
    }

    // Decrypt and test the key
    const decryptedKey = await decryptApiKey(apiKey.encryptedKey);
    const isValid = await testProviderConnection(apiKey.provider, decryptedKey);

    if (isValid) {
      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: params.id },
        data: { 
          lastUsed: new Date(),
          usageCount: { increment: 1 },
          monthlyUsage: { increment: 1 }
        }
      });

      // Log successful test
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TEST_API_KEY',
          resource: `ApiKey:${params.id}`,
          details: {
            provider: apiKey.provider,
            result: 'success'
          }
        }
      });
    } else {
      // Log failed test
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TEST_API_KEY',
          resource: `ApiKey:${params.id}`,
          details: {
            provider: apiKey.provider,
            result: 'failed'
          }
        }
      });
    }

    return NextResponse.json({ 
      valid: isValid,
      testedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to test API key:', error);
    return NextResponse.json(
      { error: 'Failed to test API key' },
      { status: 500 }
    );
  }
}