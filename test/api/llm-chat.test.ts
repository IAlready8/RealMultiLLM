import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/llm/chat/route';
import { getServerSession } from 'next-auth';
import { callLLM } from '@/lib/llm-api-client';
import { checkRateLimit } from '@/lib/rate-limit';
import { recordAnalyticsEvent } from '@/services/analytics-service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/llm-api-client', () => ({
  callLLM: vi.fn()
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn()
}));

vi.mock('@/services/analytics-service', () => ({
  recordAnalyticsEvent: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('@/lib/validation-schemas', () => ({
  validateChatRequest: vi.fn().mockImplementation((body) => ({
    provider: body.provider,
    messages: body.messages,
    options: body.options || {}
  }))
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeChatMessage: vi.fn().mockImplementation((content) => 
    content.replace(/<script[^>]*>.*<\/script>/gi, '')
  )
}));

vi.mock('@/lib/error-handler', () => ({
  safeHandleApiError: vi.fn().mockImplementation((error) =>
    Response.json({
      code: 'VALIDATION_ERROR',
      message: error.message || 'Validation failed'
    }, { status: 400 })
  ),
  ErrorCodes: { AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR' },
  createApiError: vi.fn().mockReturnValue({ 
    code: 'AUTHENTICATION_ERROR',
    message: 'Authentication required',
    timestamp: new Date().toISOString()
  })
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockCallLLM = vi.mocked(callLLM);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockRecordAnalyticsEvent = vi.mocked(recordAnalyticsEvent);

describe('/api/llm/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);
    
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockRecordAnalyticsEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (body: any) => {
    const mockRequest = {
      json: () => Promise.resolve(body),
      headers: new Map([
        ['content-type', 'application/json'],
        ['user-agent', 'test-agent'],
        ['x-forwarded-for', '127.0.0.1']
      ]),
      url: 'http://localhost:3000/api/llm/chat',
      method: 'POST'
    };
    return mockRequest as unknown as NextRequest;
  };

  it('should handle OpenAI chat request successfully', async () => {
    // Setup
    const requestBody = {
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      options: {
        temperature: 0.7,
        maxTokens: 150
      }
    };

    mockCallLLM.mockResolvedValue({
      text: 'Hello! I\'m doing well, thank you for asking.',
      usage: {
        promptTokens: 10,
        completionTokens: 12,
        totalTokens: 22
      }
    });

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    
    const responseData = await response.json();
    expect(responseData).toEqual({
      role: 'assistant',
      content: 'Hello! I\'m doing well, thank you for asking.',
      timestamp: expect.any(Number),
      metadata: {
        promptTokens: 10,
        completionTokens: 12,
        totalTokens: 22
      }
    });

    expect(mockCallLLM).toHaveBeenCalledWith(
      'openai',
      [{ role: 'user', content: 'Hello, how are you?' }],
      expect.objectContaining({
        temperature: 0.7,
        maxTokens: 150
      })
    );

    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith({
      event: 'llm_request',
      payload: expect.objectContaining({
        provider: 'openai',
        promptTokens: 10,
        completionTokens: 12,
        totalTokens: 22,
        success: true
      }),
      userId: 'test-user-id'
    });
  });

  it('should reject unauthenticated requests', async () => {
    // Setup
    mockGetServerSession.mockResolvedValue(null);
    
    const requestBody = {
      provider: 'openai',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
    
    const responseData = await response.json();
    expect(responseData.code).toBe('AUTHENTICATION_ERROR');
    expect(responseData.message).toBe('Authentication required');
  });

  it('should handle rate limit exceeded', async () => {
    // Setup
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      error: new Response(JSON.stringify({
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded. Please try again later.'
      }), { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60'
        }
      })
    });

    const requestBody = {
      provider: 'openai',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(429);
    
    const responseData = await response.json();
    expect(responseData.code).toBe('RATE_LIMIT_ERROR');
  });

  it('should handle validation errors', async () => {
    // Setup - Mock validation failure
    const { validateChatRequest } = await import('@/lib/validation-schemas');
    const mockValidateChatRequest = vi.mocked(validateChatRequest);
    mockValidateChatRequest.mockImplementation(() => {
      throw new Error('Invalid provider');
    });

    const requestBody = {
      provider: 'invalid-provider',
      messages: [] // Empty messages array should fail validation
    };

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
    
    const responseData = await response.json();
    expect(responseData.code).toBe('VALIDATION_ERROR');
  });

  it('should handle LLM API errors gracefully', async () => {
    // Setup
    const requestBody = {
      provider: 'openai',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    mockCallLLM.mockRejectedValue(new Error('OpenAI API error: Invalid API key'));

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
    
    const responseData = await response.json();
    expect(responseData.code).toBe('LLM_API_ERROR');

    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith({
      event: 'llm_error',
      payload: expect.objectContaining({
        provider: 'openai',
        success: false,
        error: 'OpenAI API error: Invalid API key'
      }),
      userId: 'test-user-id'
    });
  });

  it('should sanitize message content', async () => {
    // Setup
    const requestBody = {
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Hello <script>alert("xss")</script>' }
      ]
    };

    mockCallLLM.mockResolvedValue({
      text: 'Hello there!',
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 }
    });

    // Execute
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    
    // Verify that callLLM was called with sanitized content
    expect(mockCallLLM).toHaveBeenCalledWith(
      'openai',
      [{ role: 'user', content: 'Hello ' }], // Script tag should be removed
      expect.any(Object)
    );
  });

  it('should support different providers', async () => {
    const providers = ['openai', 'claude', 'google'];
    
    for (const provider of providers) {
      // Setup
      const requestBody = {
        provider,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      mockCallLLM.mockResolvedValue({
        text: `Response from ${provider}`,
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
      });

      // Execute
      const request = createMockRequest(requestBody);
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockCallLLM).toHaveBeenCalledWith(
        provider,
        expect.any(Array),
        expect.any(Object)
      );

      vi.clearAllMocks();
      
      // Re-setup default mocks for next iteration
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user-id', email: 'test@example.com' }
      } as any);
      mockCheckRateLimit.mockResolvedValue({ success: true });
      mockRecordAnalyticsEvent.mockResolvedValue(undefined);
    }
  });
});