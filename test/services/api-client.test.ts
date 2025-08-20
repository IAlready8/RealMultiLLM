import { describe, it, expect, beforeEach, vi } from 'vitest';
import { callLLMApi as callLLM } from '@/services/api-client';

// Mock fetch
global.fetch = vi.fn();

describe('API Client Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('callLLM', () => {
    it('should successfully call OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: 'Hello! How can I help you today?',
          metadata: {
            promptTokens: 10,
            completionTokens: 8,
            totalTokens: 18
          }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await callLLM(
        'openai',
        'Hello',
        { temperature: 0.7, maxTokens: 1000 }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result).toEqual({
        text: 'Hello! How can I help you today?',
        usage: {
          completionTokens: 8,
          promptTokens: 10,
          totalTokens: 18,
        },
        metadata: {
          completionTokens: 8,
          promptTokens: 10,
          totalTokens: 18,
        },
      });
    });

    it('should successfully call Claude API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: 'Hello! I\'m Claude, how can I assist you?',
          metadata: {
            promptTokens: 12,
            completionTokens: 10,
            totalTokens: 22
          }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await callLLM(
        'claude',
        'Hello',
        { temperature: 0.5 }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      expect(result.text).toBe('Hello! I\'m Claude, how can I assist you?');
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          message: 'Invalid API key'
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        callLLM('openai', 'Hello', {})
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(
        callLLM('openai', 'Hello', {})
      ).rejects.toThrow('Network error');
    });

    it('should handle unsupported providers', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: 'Response'
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await callLLM('unsupported' as any, 'Hello', {});

      // Just verify it makes the call - the actual provider handling is done server-side
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should use default options when none provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: 'Response',
          metadata: {
            promptTokens: 5,
            completionTokens: 3,
            totalTokens: 8
          }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await callLLM('openai', 'Hello');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.provider).toBe('openai');
      expect(requestBody.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });
  });
});