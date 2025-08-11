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
          choices: [
            {
              message: {
                content: 'Hello! How can I help you today?',
                role: 'assistant'
              }
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18
          }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await callLLM(
        'openai',
        'Hello',
        'test-api-key',
        { temperature: 0.7, maxTokens: 1000 }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      );

      expect(result).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        timestamp: expect.any(Number),
        metadata: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18
        }
      });
    });

    it('should successfully call Claude API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [
            {
              text: 'Hello! I\'m Claude, how can I assist you?'
            }
          ],
          usage: {
            input_tokens: 12,
            output_tokens: 10
          }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await callLLM(
        'claude',
        'Hello',
        'test-claude-key',
        { temperature: 0.5 }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-claude-key',
            'anthropic-version': '2023-06-01'
          }
        })
      );

      expect(result.content).toBe('Hello! I\'m Claude, how can I assist you?');
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid API key' }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        callLLM('openai', 'Hello', 'invalid-key', {})
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(
        callLLM('openai', 'Hello', 'test-key', {})
      ).rejects.toThrow('Network error');
    });

    it('should handle unsupported providers', async () => {
      await expect(
        callLLM('unsupported' as any, 'Hello', 'test-key', {})
      ).rejects.toThrow('Unsupported provider: unsupported');
    });

    it('should handle empty responses', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: []
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        callLLM('openai', 'Hello', 'test-key', {})
      ).rejects.toThrow('No response from OpenAI API');
    });

    it('should use default options when none provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Response',
                role: 'assistant'
              }
            }
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await callLLM('openai', 'Hello', 'test-key');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.temperature).toBe(0.7);
      expect(requestBody.max_tokens).toBe(2048);
    });
  });
});