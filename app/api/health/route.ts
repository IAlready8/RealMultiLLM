import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getCircuitBreakerStatus } from "@/lib/api-timeout";

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Check environment variables
    const requiredEnvVars = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    // Check LLM API keys (at least one should be present)
    const llmApiKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY', 
      'GOOGLE_AI_API_KEY'
    ];
    
    const availableLLMs = llmApiKeys.filter(key => 
      process.env[key] && 
      process.env[key] !== '' && 
      !process.env[key]?.includes('your-') &&
      !process.env[key]?.includes('here')
    );

    // Get circuit breaker status (simplified)
    const circuitBreakerStatus = {};

    const status: {
      status: string;
      timestamp: string;
      version: string;
      environment: string;
      database: string;
      llmProviders: {
        available: number;
        configured: string[];
        circuitBreakerStatus: Record<string, any>;
      };
      deployment: {
        platform: string;
        region: string;
      };
      warnings?: string[];
      errors?: string[];
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      llmProviders: {
        available: availableLLMs.length,
        configured: availableLLMs.map(key => key.replace('_API_KEY', '').toLowerCase()),
        circuitBreakerStatus
      },
      deployment: {
        platform: process.env.NETLIFY ? 'netlify' : 
                  process.env.VERCEL ? 'vercel' : 
                  process.env.RAILWAY_ENVIRONMENT ? 'railway' : 
                  'unknown',
        region: process.env.AWS_REGION || process.env.VERCEL_REGION || 'unknown'
      }
    };

    // Warning if no LLM providers configured
    if (availableLLMs.length === 0) {
      status.status = 'warning';
      status.warnings = ['No LLM API keys configured'];
    }

    // Error if critical env vars missing
    if (missingEnvVars.length > 0) {
      status.status = 'error';
      status.errors = [`Missing environment variables: ${missingEnvVars.join(', ')}`];
    }

    return NextResponse.json(status, {
      status: status.status === 'error' ? 500 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      database: 'disconnected'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}