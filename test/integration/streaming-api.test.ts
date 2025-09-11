import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockPrisma } from '../mocks/prisma';
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/llm/stream/route'
import * as authModule from 'next-auth'
import { mockSession } from '../test-utils'
import { iterNdjson } from '@/services/ndjson'

// Mock dependencies
vi.mock('next-auth')
vi.mock('@/lib/prisma', () => ({
  default: createMockPrisma(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkAndConsume: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 50,
    retryAfterMs: 0,
  }),
}))

vi.mock('@/services/api-service', () => ({
  streamChatMessage: vi.fn(),
}))

const mockGetServerSession = vi.mocked(authModule.getServerSession)
const { streamChatMessage } = await import('@/services/api-service')
const mockStreamChatMessage = vi.mocked(streamChatMessage)

describe('LLM Streaming API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/llm/stream', () => {
    it('should stream chat responses successfully', async () => {
      // Setup mock streaming response
      const testChunks = ['Hello', ' world', '!']
      
      mockStreamChatMessage.mockImplementation(async (provider, messages, onChunk) => {
        for (const chunk of testChunks) {
          onChunk(chunk)
        }
      })

      // Create request
      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Hello' }],
          options: { model: 'gpt-4', temperature: 0.7 },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Call the API
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8')

      // Parse streaming response
      const chunks: any[] = []
      const body = response.body
      if (body) {
        for await (const obj of iterNdjson(body)) {
          chunks.push(obj)
        }
      }

      // Verify chunks
      expect(chunks).toHaveLength(4) // 3 content chunks + 1 done
      expect(chunks[0]).toEqual({ type: 'chunk', content: 'Hello' })
      expect(chunks[1]).toEqual({ type: 'chunk', content: ' world' })
      expect(chunks[2]).toEqual({ type: 'chunk', content: '!' })
      expect(chunks[3]).toEqual({ type: 'done' })

      // Verify service was called correctly
      expect(mockStreamChatMessage).toHaveBeenCalledWith(
        'openai',
        [{ role: 'user', content: 'Hello' }],
        expect.any(Function),
        expect.objectContaining({
          model: 'gpt-4',
          temperature: 0.7,
          abortSignal: expect.any(AbortSignal),
        })
      )
    })

    it('should handle authentication errors', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: '',
          messages: [],
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should handle rate limit errors', async () => {
      const { checkAndConsume } = await import('@/lib/rate-limit')
      vi.mocked(checkAndConsume).mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterMs: 60000,
      })

      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(429)

      const data = await response.json()
      expect(data).toHaveProperty('retryAfterMs', 60000)
    })

    it('should handle streaming errors gracefully', async () => {
      const testError = new Error('Provider unavailable')
      
      mockStreamChatMessage.mockRejectedValue(testError)

      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200) // Streaming response starts successfully

      // Parse error from stream
      const chunks: any[] = []
      const body = response.body
      if (body) {
        for await (const obj of iterNdjson(body)) {
          chunks.push(obj)
        }
      }

      // Should contain error event
      const errorChunk = chunks.find(chunk => chunk.type === 'error')
      expect(errorChunk).toBeDefined()
      expect(errorChunk.error).toBe('Provider unavailable')
    })

    it('should handle request abortion', async () => {
      const controller = new AbortController()
      
      mockStreamChatMessage.mockImplementation(async (provider, messages, onChunk, options) => {
        // Simulate long-running operation
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 5000)
          
          options?.abortSignal?.addEventListener('abort', () => {
            clearTimeout(timeout)
            reject(new Error('Request aborted'))
          })
        })
      })

      const request = new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'openai',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        signal: controller.signal,
      })

      // Start the request
      const responsePromise = POST(request)
      
      // Abort after 100ms
      setTimeout(() => controller.abort(), 100)

      const response = await responsePromise
      expect(response.status).toBe(200)

      // Parse response to check for abort event
      const chunks: any[] = []
      const body = response.body
      if (body) {
        try {
          for await (const obj of iterNdjson(body)) {
            chunks.push(obj)
          }
        } catch (error) {
          // Stream may be aborted
        }
      }

      // Should contain aborted event or error
      const abortedOrError = chunks.some(chunk => 
        chunk.type === 'aborted' || chunk.type === 'error'
      )
      expect(abortedOrError).toBe(true)
    })

    it('should handle multiple concurrent requests', async () => {
      mockStreamChatMessage.mockImplementation(async (provider, messages, onChunk) => {
        onChunk(`Response from ${provider}`)
      })

      const createRequest = (provider: string) => new NextRequest('http://localhost/api/llm/stream', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      })

      // Create multiple requests
      const requests = [
        createRequest('openai'),
        createRequest('anthropic'),
        createRequest('googleai'),
      ]

      // Execute concurrently
      const responses = await Promise.all(requests.map(req => POST(req)))

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Parse all responses
      const allChunks = await Promise.all(
        responses.map(async (response) => {
          const chunks: any[] = []
          const body = response.body
          if (body) {
            for await (const obj of iterNdjson(body)) {
              chunks.push(obj)
            }
          }
          return chunks
        })
      )

      // Each should have content and done
      allChunks.forEach(chunks => {
        expect(chunks).toHaveLength(2) // content + done
        expect(chunks[0].type).toBe('chunk')
        expect(chunks[1].type).toBe('done')
      })
    })

    it('should validate request payload schema', async () => {
      const invalidPayloads = [
        // Missing provider
        { messages: [{ role: 'user', content: 'Hello' }] },
        
        // Invalid provider
        { provider: 'invalid-provider', messages: [{ role: 'user', content: 'Hello' }] },
        
        // Empty messages
        { provider: 'openai', messages: [] },
        
        // Invalid message format
        { provider: 'openai', messages: [{ role: 'invalid', content: 'Hello' }] },
        
        // Missing message content
        { provider: 'openai', messages: [{ role: 'user' }] },
      ]

      for (const payload of invalidPayloads) {
        const request = new NextRequest('http://localhost/api/llm/stream', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        const response = await POST(request)
        expect(response.status).toBe(400)
      }
    })

    it('should handle different message types and options', async () => {
      mockStreamChatMessage.mockImplementation(async (provider, messages, onChunk, options) => {
        onChunk(`Provider: ${provider}, Model: ${options?.model || 'default'}`)
      })

      const testCases = [
        {
          payload: {
            provider: 'openai',
            messages: [
              { role: 'system', content: 'You are helpful' },
              { role: 'user', content: 'Hello' },
            ],
            options: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
          },
          expectedOptions: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
        },
        {
          payload: {
            provider: 'anthropic',
            messages: [{ role: 'user', content: 'Hello' }],
            options: { model: 'claude-3-opus' },
          },
          expectedOptions: { model: 'claude-3-opus' },
        },
      ]

      for (const testCase of testCases) {
        const request = new NextRequest('http://localhost/api/llm/stream', {
          method: 'POST',
          body: JSON.stringify(testCase.payload),
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        // Verify service was called with correct options
        expect(mockStreamChatMessage).toHaveBeenCalledWith(
          testCase.payload.provider,
          testCase.payload.messages,
          expect.any(Function),
          expect.objectContaining({
            ...testCase.expectedOptions,
            abortSignal: expect.any(AbortSignal),
          })
        )
      }
    })
  })
})
