import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { configManager } from '@/lib/config-manager'
import { badRequest, unauthorized, internalError } from '@/lib/http'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return unauthorized()
  }

  try {
    const { provider, config } = await request.json()

    if (!provider || !config) {
      return badRequest('Provider and config are required')
    }

    // Validate provider configuration
    const validation = configManager.validateProviderConfig(config)
    
    if (!validation.ok) {
      return NextResponse.json({
        success: false,
        errors: validation.errors?.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })) || [],
      })
    }

    // Test connection if API key is provided
    let connectionTest = null
    if (validation.data?.apiKey) {
      try {
        connectionTest = await configManager.testProviderConnection(provider, validation.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown connection test error';
        connectionTest = { success: false, error: message }
      }
    }

    return NextResponse.json({
      success: true,
      data: validation.data,
      connectionTest,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return internalError(message);
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return unauthorized()
  }

  try {
    const url = new URL(request.url)
    const provider = url.searchParams.get('provider')

    if (provider) {
      // Get specific provider config
      const config = await configManager.getProviderConfig(session.user.id, provider)
      return NextResponse.json({ config })
    } else {
      // Get all provider configs
      const configs = await configManager.getAllProviderConfigs(session.user.id)
      return NextResponse.json({ configs })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load configuration';
    return internalError(message);
  }
}