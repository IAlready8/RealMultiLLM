/**
 * Enhanced Provider Test Service
 * Tests API key connectivity and validity for all supported providers
 * Provides real-time pass/fail feedback with detailed error information
 */

export interface TestResult {
  success: boolean;
  message: string;
  provider: string;
  details?: {
    error?: string;
    statusCode?: number;
    responseTime?: number;
    model?: string;
    rateLimit?: {
      remaining?: number;
      reset?: number;
    };
  };
}

/**
 * Test connectivity to a specific provider
 */
export async function testProviderConnectivity(provider: string, apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    switch (provider.toLowerCase()) {
      case 'openai':
      case 'openai-api':
        return await testOpenAI(apiKey);
      case 'anthropic':
      case 'claude':
        return await testAnthropic(apiKey);
      case 'google':
      case 'google-ai':
      case 'gemini':
        return await testGoogleAI(apiKey);
      case 'openrouter':
        return await testOpenRouter(apiKey);
      case 'grok':
      case 'xai':
        return await testGrok(apiKey);
      case 'llama':
      case 'ollama':
        return await testLlama(apiKey);
      case 'github':
      case 'copilot':
        return await testGitHub(apiKey);
      default:
        return {
          success: false,
          message: `Unsupported provider: ${provider}`,
          provider,
        };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      },
      provider,
    };
  }
}

/**
 * Test OpenAI API connectivity with enhanced error handling
 */
async function testOpenAI(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `OpenAI API error: ${response.status} ${response.statusText}`,
        details: {
          error: errorData.error?.message || 'Unknown error',
          statusCode: response.status,
          responseTime,
        },
        provider: 'openai',
      };
    }

    const data = await response.json();
    const modelCount = Array.isArray(data.data) ? data.data.length : 0;

    return {
      success: true,
      message: `OpenAI connection successful (${modelCount} models available)`,
      details: {
        responseTime,
        model: 'gpt-4o', // Default model for testing
      },
      provider: 'openai',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'OpenAI API test timed out after 15 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'openai',
      };
    }

    return {
      success: false,
      message: `OpenAI connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'openai',
    };
  }
}

/**
 * Test Anthropic API connectivity with enhanced error handling
 */
async function testAnthropic(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test connection' }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Anthropic API error: ${response.status} ${response.statusText}`,
        details: {
          error: errorData.error?.message || 'Unknown error',
          statusCode: response.status,
          responseTime,
        },
        provider: 'anthropic',
      };
    }

    return {
      success: true,
      message: 'Anthropic connection successful',
      details: {
        responseTime,
        model: 'claude-3-haiku-20240307',
      },
      provider: 'anthropic',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Anthropic API test timed out after 20 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'anthropic',
      };
    }

    return {
      success: false,
      message: `Anthropic connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'anthropic',
    };
  }
}

/**
 * Test Google AI API connectivity with enhanced error handling
 */
async function testGoogleAI(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Google AI API error: ${response.status} ${response.statusText}`,
        details: {
          error: errorData.error?.message || 'Unknown error',
          statusCode: response.status,
          responseTime,
        },
        provider: 'google',
      };
    }

    const data = await response.json();
    const modelCount = Array.isArray(data.models) ? data.models.length : 0;

    return {
      success: true,
      message: `Google AI connection successful (${modelCount} models available)`,
      details: {
        responseTime,
        model: 'gemini-pro',
      },
      provider: 'google',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Google AI API test timed out after 15 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'google',
      };
    }

    return {
      success: false,
      message: `Google AI connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'google',
    };
  }
}

/**
 * Test OpenRouter API connectivity with enhanced error handling
 */
async function testOpenRouter(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `OpenRouter API error: ${response.status} ${response.statusText}`,
        details: {
          error: errorData.error?.message || 'Unknown error',
          statusCode: response.status,
          responseTime,
        },
        provider: 'openrouter',
      };
    }

    const data = await response.json();
    const modelCount = Array.isArray(data.data) ? data.data.length : 0;

    return {
      success: true,
      message: `OpenRouter connection successful (${modelCount} models available)`,
      details: {
        responseTime,
        model: 'openrouter/auto', // OpenRouter's auto model selection
      },
      provider: 'openrouter',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'OpenRouter API test timed out after 15 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'openrouter',
      };
    }

    return {
      success: false,
      message: `OpenRouter connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'openrouter',
    };
  }
}

/**
 * Test Grok API connectivity with enhanced error handling
 */
async function testGrok(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Grok API error: ${response.status} ${response.statusText}`,
        details: {
          error: errorData.error?.message || 'Unknown error',
          statusCode: response.status,
          responseTime,
        },
        provider: 'grok',
      };
    }

    const data = await response.json();
    const modelCount = Array.isArray(data.data) ? data.data.length : 0;

    return {
      success: true,
      message: `Grok connection successful (${modelCount} models available)`,
      details: {
        responseTime,
        model: 'grok-1',
      },
      provider: 'grok',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Grok API test timed out after 15 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'grok',
      };
    }

    return {
      success: false,
      message: `Grok connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'grok',
    };
  }
}

/**
 * Test Llama API connectivity (for Ollama/local models) - Enhanced version
 */
async function testLlama(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // For local models like Ollama, we typically don't use API keys
    // Instead, we test the connection to the local endpoint
    // In the enhanced version, we can test against a configurable local endpoint
    const llamaEndpoint = process.env.LLAMA_API_URL || 'http://localhost:11434/api/tags';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(llamaEndpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        message: `Llama API error: ${response.status} ${response.statusText}`,
        details: {
          error: 'Failed to connect to Llama API endpoint',
          statusCode: response.status,
          responseTime,
        },
        provider: 'llama',
      };
    }

    const data = await response.json();
    const modelCount = Array.isArray(data.models) ? data.models.length : 0;

    return {
      success: true,
      message: `Llama connection successful (${modelCount} models available)`,
      details: {
        responseTime,
        model: 'llama3', // Default model for testing
      },
      provider: 'llama',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Llama API test timed out after 10 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'llama',
      };
    }

    return {
      success: false,
      message: `Llama connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Network error',
        responseTime: Date.now() - startTime,
      },
      provider: 'llama',
    };
  }
}

/**
 * Test GitHub Copilot API connectivity - Enhanced version
 */
async function testGitHub(apiKey: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // GitHub Copilot uses different authentication, typically through GitHub tokens
    if (!apiKey.startsWith('gho_') && !apiKey.startsWith('github_pat_')) {
      return {
        success: false,
        message: 'GitHub token should start with "gho_" or "github_pat_"',
        details: {
          error: 'Invalid GitHub token format',
          responseTime: Date.now() - startTime,
        },
        provider: 'github',
      };
    }

    // Test against GitHub API to validate token
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        message: `GitHub API error: ${response.status} ${response.statusText}`,
        details: {
          error: 'Invalid GitHub token or insufficient permissions',
          statusCode: response.status,
          responseTime,
        },
        provider: 'github',
      };
    }

    // Optionally check if Copilot is available
    const userData = await response.json();
    if (!userData?.login) {
      return {
        success: false,
        message: 'GitHub token validation failed',
        details: {
          error: 'Could not validate GitHub token',
          responseTime,
        },
        provider: 'github',
      };
    }

    return {
      success: true,
      message: 'GitHub token is valid',
      details: {
        responseTime,
      },
      provider: 'github',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'GitHub API test timed out after 10 seconds',
        details: {
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        },
        provider: 'github',
      };
    }

    return {
      success: false,
      message: `GitHub token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      },
      provider: 'github',
    };
  }
}