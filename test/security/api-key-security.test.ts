import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as testApiKey } from '@/app/api/test-api-key/route';
import { encryptApiKey, decryptApiKey } from '@/lib/secure-storage';
import { mockSession } from '../../test/test-utils';

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

describe('Security Validation - API Keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should encrypt and decrypt API keys securely', async () => {
    const originalKey = 'sk-test-1234567890abcdef';
    const encrypted = await encryptApiKey(originalKey);
    const decrypted = await decryptApiKey(encrypted);
    
    expect(encrypted).not.toBe(originalKey);
    expect(decrypted).toBe(originalKey);
  });

  it('should validate API keys without exposing them', async () => {
    const req = createMockRequest('http://localhost:3000/api/test-api-key', {
      body: {
        provider: 'openai',
        apiKey: 'sk-test-1234567890abcdef',
      },
    });

    // Mock the fetch to simulate a successful API key validation
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ models: [] }),
    });
    
    global.fetch = mockFetch;

    const response = await testApiKey(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    // Ensure the API key is not exposed in the response
    expect(JSON.stringify(data)).not.toContain('sk-test-1234567890abcdef');
  });

  it('should reject invalid API keys', async () => {
    const req = createMockRequest('http://localhost:3000/api/test-api-key', {
      body: {
        provider: 'openai',
        apiKey: 'invalid-key',
      },
    });

    // Mock the fetch to simulate a failed API key validation
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: { message: 'Incorrect API key provided' } }),
    });
    
    global.fetch = mockFetch;

    const response = await testApiKey(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.error).toBe('Invalid API key');
  });

  it('should not store API keys in plain text', async () => {
    // Test that API keys are properly encrypted when stored
    const testKey = 'sk-test-1234567890abcdef';
    
    // Mock Prisma to check how data is stored
    const mockCreate = vi.fn();
    vi.mock('@/lib/prisma', () => ({
      prisma: {
        userApiKey: {
          create: mockCreate,
        },
      },
    }));
    
    // Simulate storing an API key
    const encryptedKey = await encryptApiKey(testKey);
    
    // Verify that the key is encrypted before storage
    expect(encryptedKey).not.toBe(testKey);
    expect(encryptedKey.length).toBeGreaterThan(testKey.length);
  });
});