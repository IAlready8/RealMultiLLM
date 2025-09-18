
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { deleteUserProviderConfig, hasValidApiKey } from '@/lib/api-key-service';
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

// Schema to validate the dynamic route parameter
const routeContextSchema = z.object({
  provider: z.enum(validProviders),
});

interface RouteParams {
  provider: string;
}

// DELETE /api/provider-configs/[provider] - Delete a provider configuration
export async function DELETE(request: Request, context: { params: RouteParams }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(context.params);

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
      provider: context.params.provider, // Log the raw param on error
      error: error.message,
    });
    return internalError('Failed to delete provider configuration');
  }
}

// GET /api/provider-configs/[provider] - Check if user has valid API key
export async function GET(request: Request, context: { params: RouteParams }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return unauthorized();
  }

  try {
    const { provider } = routeContextSchema.parse(context.params);

    const hasKey = await hasValidApiKey(session.user.id, provider);

    return NextResponse.json({
      provider: provider,
      hasValidKey: hasKey,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return badRequest('Invalid provider in URL', { details: error.issues });
    }
    logger.error('Failed to check provider configuration status', {
      userId: session.user.id,
      provider: context.params.provider, // Log the raw param on error
      error: error.message,
    });
    return internalError('Failed to check provider configuration status');
  }
}
