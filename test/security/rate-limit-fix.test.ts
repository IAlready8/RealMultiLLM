/**
 * PHASE 1 SECURITY VALIDATION: Rate Limit Bypass Protection
 *
 * Tests to ensure the critical security vulnerability is fixed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/register/route';

// Mock the enterprise rate limiter
vi.mock('@/lib/rate-limiter-enterprise', () => ({
  enterpriseRateLimiter: {
    checkRateLimit: vi.fn()
  },
  defaultConfigs: {
    auth: {
      maxRequests: 5,
      windowMs: 300000
    }
  }
}));

// Mock audit logger
vi.mock('@/lib/audit-logger', () => ({
  auditLogger: {
    logSecurityEvent: vi.fn(),
    logAuthenticationEvent: vi.fn()
  }
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password')
  }
}));

// Mock password validator
vi.mock('@/lib/password-validator', () => ({
  getPasswordSchema: vi.fn().mockReturnValue({
    parse: vi.fn().mockReturnValue('valid-password')
  }),
  validatePasswordStrength: vi.fn().mockReturnValue({
    score: 80,
    level: 'strong',
    feedback: []
  }),
  checkPasswordBreach: vi.fn().mockResolvedValue({
    isCompromised: false,
    occurrences: 0
  })
}));

describe('PHASE 1 SECURITY: Rate Limit Bypass Protection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('CRITICAL: should not bypass rate limiting in production even with NODE_ENV=test', async () => {
    // Simulate production environment with malicious NODE_ENV
    process.env.NODE_ENV = 'test'; // Attacker trying to bypass
    process.env.VITEST = undefined; // Not in actual test environment

    const { enterpriseRateLimiter } = await import('@/lib/rate-limiter-enterprise');

    // Mock rate limiter to return blocked status
    vi.mocked(enterpriseRateLimiter.checkRateLimit).mockResolvedValue({
      isBlocked: true,
      msBeforeNext: 60000
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '192.168.1.1'
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPassword123!'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // Should be rate limited despite NODE_ENV=test
    expect(response.status).toBe(429);
    expect(data.message).toContain('Too many registration attempts');
    expect(enterpriseRateLimiter.checkRateLimit).toHaveBeenCalled();
  });

  it('SECURE: should allow bypass only in legitimate test environment', async () => {
    // Legitimate test environment
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true'; // Actual test environment

    const { enterpriseRateLimiter } = await import('@/lib/rate-limiter-enterprise');

    // Rate limiter should not be called in test mode
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '192.168.1.1'
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPassword123!'
      })
    });

    // Mock successful user creation
    const { default: prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      password: null,
      image: null,
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await POST(request);

    // Should succeed in legitimate test environment
    expect(response.status).toBe(201);
    expect(enterpriseRateLimiter.checkRateLimit).not.toHaveBeenCalled();
  });

  it('SECURE: should enforce rate limiting in production environment', async () => {
    // Production environment
    process.env.NODE_ENV = 'production';
    process.env.VITEST = undefined;

    const { enterpriseRateLimiter } = await import('@/lib/rate-limiter-enterprise');

    // Mock rate limiter to return allowed status
    vi.mocked(enterpriseRateLimiter.checkRateLimit).mockResolvedValue({
      isBlocked: false,
      msBeforeNext: 0
    });

    // Mock successful user creation
    const { default: prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      password: null,
      image: null,
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '192.168.1.1'
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPassword123!'
      })
    });

    const response = await POST(request);

    // Should call rate limiter in production
    expect(enterpriseRateLimiter.checkRateLimit).toHaveBeenCalledWith(
      'registration:ip:192.168.1.1',
      expect.objectContaining({
        maxRequests: 3,
        windowMs: 60 * 60 * 1000
      }),
      request
    );
    expect(response.status).toBe(201);
  });
});