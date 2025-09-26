import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as callLLM } from '@/app/api/llm/call/route';
import { POST as compareModels } from '@/app/api/llm/compare/route';
import { mockSession } from '../../test/test-utils';
import { callLLM as callLLMService } from '@/services/api-client';

// Mock the LLM service
vi.mock('@/services/api-client', () => ({
  callLLM: vi.fn(),
}));

// Mock NextAuth
vi.mock('next-auth', async () => {
  const actual = await vi.importActual('next-auth');
  return {
    ...actual,
    getServerSession: vi.fn().mockResolvedValue(mockSession),
  };
});

// Mock NextRequest
const createMockRequest = (url: string, options: any = {}) => {
  return {
    url,
    json: vi.fn().mockResolvedValue(options.body || {}),
    headers: {
      get: vi.fn().mockReturnValue(options.headers?.['content-type'] || 'application/json'),
    },
    ...options,
  };
};

describe('LLM API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call a single LLM and return response', async () => {
    const mockResponse = {
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: Date.now(),
      metadata: {
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      },
    };

    (callLLMService as any).mockResolvedValue(mockResponse);

    const req = createMockRequest('http://localhost:3000/api/llm/call', {
      body: {
        provider: 'openai',
        prompt: 'Hello',
        apiKey: 'test-key',
        options: { temperature: 0.7 },
      },
    });

    const response = await callLLM(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toBe('Hello! How can I help you today?');
    expect(callLLMService).toHaveBeenCalledWith('openai', 'Hello', 'test-key', { temperature: 0.7 });
  });

  it('should compare multiple models and return responses', async () => {
    const mockResponses = [
      {
        provider: 'openai',
        response: {
          role: 'assistant',
          content: 'Hello from OpenAI!',
          timestamp: Date.now(),
        },
      },
      {
        provider: 'claude',
        response: {
          role: 'assistant',
          content: 'Hello from Claude!',
          timestamp: Date.now(),
        },
      },
    ];

    (callLLMService as any).mockImplementation(async (provider: string) => {
      if (provider === 'openai') {
        return mockResponses[0].response;
      } else if (provider === 'claude') {
        return mockResponses[1].response;
      }
      throw new Error('Unsupported provider');
    });

    const req = createMockRequest('http://localhost:3000/api/llm/compare', {
      body: {
        providers: ['openai', 'claude'],
        prompt: 'Hello',
        apiKeys: {
          openai: 'openai-key',
          claude: 'claude-key',
        },
        options: { temperature: 0.7 },
      },
    });

    const response = await compareModels(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0].provider).toBe('openai');
    expect(data[1].provider).toBe('claude');
    expect(data[0].response.content).toBe('Hello from OpenAI!');
    expect(data[1].response.content).toBe('Hello from Claude!');
  });

  it('should handle LLM call errors gracefully', async () => {
    (callLLMService as any).mockRejectedValue(new Error('API Error'));

    const req = createMockRequest('http://localhost:3000/api/llm/call', {
      body: {
        provider: 'openai',
        prompt: 'Hello',
        apiKey: 'invalid-key',
        options: { temperature: 0.7 },
      },
    });

    const response = await callLLM(req);
    
    expect(response.status).toBe(500);
  });
});