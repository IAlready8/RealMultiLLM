import { describe, it, expect, beforeEach, vi } from 'vitest';
import { callLLMApi } from '@/services/api-client';
import * as crypto from '@/lib/crypto';

// Mock fetch
global.fetch = vi.fn();

// Mock crypto
vi.mock('@/lib/crypto', () => ({
  decryptApiKey: vi.fn(key => `decrypted_${key}`),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('API Client Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should successfully call OpenAI API with key from localStorage', async () => {
    localStorageMock.setItem('apiKey_openai', 'encrypted_test_key');

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello from OpenAI' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await callLLMApi('openai', 'Hello');

    expect(crypto.decryptApiKey).toHaveBeenCalledWith('encrypted_test_key');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer decrypted_encrypted_test_key',
        }),
      })
    );
    expect(result.text).toBe('Hello from OpenAI');
  });

  it('should throw an error if no API key is found', async () => {
    await expect(callLLMApi('openai', 'Hello')).rejects.toThrow(
      'No API key found for openai. Please set up your API key in the settings.'
    );
  });

  it('should handle API errors gracefully', async () => {
    localStorageMock.setItem('apiKey_openai', 'encrypted_test_key');
    const mockResponse = {
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    await expect(callLLMApi('openai', 'Hello')).rejects.toThrow(
      'Invalid API key'
    );
  });

  it('should handle unsupported providers', async () => {
    localStorageMock.setItem('apiKey_unsupported', 'encrypted_test_key');
    await expect(callLLMApi('unsupported', 'Hello')).rejects.toThrow(
      'Provider unsupported not supported'
    );
  });
});
