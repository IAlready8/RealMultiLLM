import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock all dependencies
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
  ChatRequestSchema: {},
  validateChatRequest: vi.fn()
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeChatMessage: vi.fn()
}));

vi.mock('@/lib/error-handler', () => ({
  safeHandleApiError: vi.fn(() => new Response(JSON.stringify({ error: 'mocked error' }), { status: 500 })),
  ErrorCodes: { AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR' },
  createApiError: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

describe('/api/llm/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // Setup mocks
    const mockGetServerSession = vi.mocked(getServerSession);
    const mockCallLLM = (await import('@/lib/llm-api-client')).callLLM as any;
    const mockCheckRateLimit = (await import('@/lib/rate-limit')).checkRateLimit as any;
    const mockRecordAnalyticsEvent = (await import('@/services/analytics-service')).recordAnalyticsEvent as any;
    const mockValidateChatRequest = (await import('@/lib/validation-schemas')).validateChatRequest as any;
    const mockSanitizeChatMessage = (await import('@/lib/sanitize')).sanitizeChatMessage as any;

    // Configure mocks
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);
    
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockRecordAnalyticsEvent.mockResolvedValue(undefined);

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

    mockValidateChatRequest.mockReturnValue(requestBody);
    mockSanitizeChatMessage.mockImplementation((content: string) => content);
    mockCallLLM.mockResolvedValue({
      text: 'Hello! I\'m doing well, thank you for asking.',
      usage: {
        promptTokens: 10,
        completionTokens: 12,
        totalTokens: 22
      }
    });

    // Import and execute
    const { POST } = await import('@/app/api/llm/chat/route');
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

  it('should sanitize message content', async () => {
    // Setup mocks
    const mockGetServerSession = vi.mocked(getServerSession);
    const mockCallLLM = (await import('@/lib/llm-api-client')).callLLM as any;
    const mockCheckRateLimit = (await import('@/lib/rate-limit')).checkRateLimit as any;
    const mockRecordAnalyticsEvent = (await import('@/services/analytics-service')).recordAnalyticsEvent as any;
    const mockValidateChatRequest = (await import('@/lib/validation-schemas')).validateChatRequest as any;
    const mockSanitizeChatMessage = (await import('@/lib/sanitize')).sanitizeChatMessage as any;

    // Configure mocks
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    } as any);
    
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockRecordAnalyticsEvent.mockResolvedValue(undefined);

    const requestBody = {
      provider: 'openai',
      messages: [
        { role: 'user', content: 'Hello <script>alert("xss")</script>' }
      ]
    };

    mockValidateChatRequest.mockReturnValue(requestBody);
    // Mock sanitization removing script tag
    mockSanitizeChatMessage.mockReturnValue('Hello ');
    
    mockCallLLM.mockResolvedValue({
      text: 'Hello there!',
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 }
    });

    // Import and execute
    const { POST } = await import('@/app/api/llm/chat/route');
    const request = createMockRequest(requestBody);
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    
    // Verify that sanitization was called
    expect(mockSanitizeChatMessage).toHaveBeenCalledWith('Hello <script>alert("xss")</script>');
    
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
      // Setup mocks for each iteration
      const mockGetServerSession = vi.mocked(getServerSession);
      const mockCallLLM = (await import('@/lib/llm-api-client')).callLLM as any;
      const mockCheckRateLimit = (await import('@/lib/rate-limit')).checkRateLimit as any;
      const mockRecordAnalyticsEvent = (await import('@/services/analytics-service')).recordAnalyticsEvent as any;
      const mockValidateChatRequest = (await import('@/lib/validation-schemas')).validateChatRequest as any;
      const mockSanitizeChatMessage = (await import('@/lib/sanitize')).sanitizeChatMessage as any;

      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user-id', email: 'test@example.com' }
      } as any);
      mockCheckRateLimit.mockResolvedValue({ success: true });
      mockRecordAnalyticsEvent.mockResolvedValue(undefined);

      const requestBody = {
        provider,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      mockValidateChatRequest.mockReturnValue(requestBody);
      mockSanitizeChatMessage.mockImplementation((content: string) => content);
      
      mockCallLLM.mockResolvedValue({
        text: `Response from ${provider}`,
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
      });

      // Execute
      const { POST } = await import('@/app/api/llm/chat/route');
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
    }
  });
});