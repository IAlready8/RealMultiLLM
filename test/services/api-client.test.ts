import { describe, it, expect, beforeEach, vi } from 'vitest';
import { callLLMApi } from '@/services/api-client';

// Mock fetch
global.fetch = vi.fn();

// Mock secure storage
vi.mock('@/lib/secure-storage', () => ({
  getStoredApiKey: vi.fn(),
  getLegacyApiKeyIfPresent: vi.fn(),
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

// Move dynamic import to top-level to avoid non-top-level await in tests
const secureStorageModulePromise = import('@/lib/secure-storage');

describe('API Client Service', () => {
  let mockGetStoredApiKey: any;
  let mockGetLegacyApiKey: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  beforeAll(async () => {
    const { getStoredApiKey, getLegacyApiKeyIfPresent } = await secureStorageModulePromise;
    mockGetStoredApiKey = vi.mocked(getStoredApiKey);
    mockGetLegacyApiKey = vi.mocked(getLegacyApiKeyIfPresent);
  });

  it('should successfully call OpenAI API with key from secure storage', async () => {
    mockGetStoredApiKey.mockResolvedValue('test_api_key');

    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello from OpenAI' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await callLLMApi('openai', 'Hello');

    expect(mockGetStoredApiKey).toHaveBeenCalledWith('openai');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test_api_key',
        }),
      })
    );
    expect(result.text).toBe('Hello from OpenAI');
  });

  it('should throw an error if no API key is found', async () => {
    mockGetStoredApiKey.mockResolvedValue(null);
    mockGetLegacyApiKey.mockResolvedValue(null);

    await expect(callLLMApi('openai', 'Hello')).rejects.toThrow(
      'No API key found for openai. Please set up your API key in the settings.'
    );
  });

  it('should handle API errors gracefully', async () => {
    mockGetStoredApiKey.mockResolvedValue('test_api_key');
    
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
    mockGetStoredApiKey.mockResolvedValue('test_api_key');
    
    await expect(callLLMApi('unsupported', 'Hello')).rejects.toThrow(
      'Provider unsupported not supported'
    );
  });
});
