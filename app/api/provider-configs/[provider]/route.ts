import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteUserProviderConfig, hasValidApiKey } from '@/lib/api-key-service'
import { badRequest, internalError, unauthorized } from '@/lib/http'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{
    provider: string
  }>
}

// DELETE /api/provider-configs/[provider] - Delete a provider configuration
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return unauthorized()
  }

  try {
    const { provider } = await params

    if (!provider) {
      return badRequest('Provider parameter is required')
    }

    await deleteUserProviderConfig(session.user.id, provider.toLowerCase())

    logger.info('provider_config_deleted', {
      userId: session.user.id,
      provider: provider.toLowerCase(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const { provider: providerName } = await params;
    logger.error('provider_config_delete_error', {
      userId: session.user.id,
      provider: providerName,
      message: error?.message,
    })
    return internalError('Failed to delete provider configuration')
  }
}

// GET /api/provider-configs/[provider]/status - Check if user has valid API key
export async function GET(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return unauthorized()
  }

  try {
    const { provider } = await params

    if (!provider) {
      return badRequest('Provider parameter is required')
    }

    const hasKey = await hasValidApiKey(session.user.id, provider.toLowerCase())

    return NextResponse.json({
      provider: provider.toLowerCase(),
      hasValidKey: hasKey,
    })
  } catch (error: any) {
    const { provider: providerName } = await params;
    logger.error('provider_config_status_error', {
      userId: session.user.id,
      provider: providerName,
      message: error?.message,
    })
    return internalError('Failed to check provider configuration status')
  }
}