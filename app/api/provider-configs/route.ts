import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  storeUserApiKey,
  getUserProviderConfigs,
  deleteUserProviderConfig,
  updateProviderSettings,
} from '@/lib/api-key-service'
import { badRequest, internalError, unauthorized } from '@/lib/http'
import { logger } from '@/lib/logger'

// GET /api/provider-configs - Get all provider configurations for the user
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return unauthorized()
  }

  try {
    const configs = await getUserProviderConfigs(session.user.id)
    return NextResponse.json({ configs })
  } catch (error: any) {
    logger.error('provider_configs_get_error', { 
      userId: session.user.id, 
      message: error?.message 
    })
    return internalError('Failed to fetch provider configurations')
  }
}

// POST /api/provider-configs - Store or update a provider configuration
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return unauthorized()
  }

  try {
    const body = await request.json()
    const { provider, apiKey, settings } = body

    if (!provider || typeof provider !== 'string') {
      return badRequest('Provider name is required')
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return badRequest('API key is required')
    }

    // Validate provider name (security check)
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
    ]

    if (!validProviders.includes(provider.toLowerCase())) {
      return badRequest(`Invalid provider: ${provider}`)
    }

    const config = await storeUserApiKey(
      session.user.id,
      provider.toLowerCase(),
      apiKey,
      settings
    )

    logger.info('provider_config_stored', {
      userId: session.user.id,
      provider: provider.toLowerCase(),
    })

    // Return configuration without the API key
    return NextResponse.json({ config })
  } catch (error: any) {
    logger.error('provider_configs_post_error', {
      userId: session.user.id,
      message: error?.message,
    })
    return internalError('Failed to store provider configuration')
  }
}

// PUT /api/provider-configs - Update provider settings only
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return unauthorized()
  }

  try {
    const body = await request.json()
    const { provider, settings } = body

    if (!provider || typeof provider !== 'string') {
      return badRequest('Provider name is required')
    }

    if (!settings || typeof settings !== 'object') {
      return badRequest('Settings object is required')
    }

    const config = await updateProviderSettings(
      session.user.id,
      provider.toLowerCase(),
      settings
    )

    if (!config) {
      return NextResponse.json(
        { error: 'Provider configuration not found' },
        { status: 404 }
      )
    }

    logger.info('provider_settings_updated', {
      userId: session.user.id,
      provider: provider.toLowerCase(),
    })

    return NextResponse.json({ config })
  } catch (error: any) {
    logger.error('provider_configs_put_error', {
      userId: session.user.id,
      message: error?.message,
    })
    return internalError('Failed to update provider settings')
  }
}