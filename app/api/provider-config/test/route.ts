/**
 * Provider Configuration Test API Route
 * Tests API keys in real-time against provider endpoints
 * Returns pass/fail status with detailed error information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserApiKey } from '@/lib/api-key-service';
import { testProviderConnection } from '@/services/llm-providers/registry';
import { z } from 'zod';

const testSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(), // Optional - if not provided, will fetch from stored config
});

// POST /api/provider-config/test - Test provider API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey } = testSchema.parse(body);

    let testApiKey: string | undefined;
    
    if (apiKey) {
      // Use the API key provided in the request body
      testApiKey = apiKey;
    } else {
      // Get the user's provider configuration
      const storedApiKey = await getUserApiKey(session.user.id, provider);
      testApiKey = storedApiKey ?? undefined;
      if (!testApiKey) {
        return NextResponse.json({ 
          success: false, 
          error: 'No API key provided or configured for this provider',
          provider 
        }, { status: 400 });
      }
    }

    // Test the API key with real provider
    const testResult = await testProviderConnection(provider, testApiKey);

    return NextResponse.json({
      provider,
      success: testResult.success,
      message: testResult.error || (testResult.success ? 'Connection successful' : 'Connection failed'),
      details: testResult.details,
      latency: testResult.latencyMs,
      error: testResult.error,
      timestamp: new Date().toISOString(),
      testedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.issues }, { status: 400 });
    }

    console.error('Error testing provider config:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      success: false,
      message: 'Test failed due to server error'
    }, { status: 500 });
  }
}
