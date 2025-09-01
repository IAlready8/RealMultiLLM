import { describe, it, expect, vi, beforeEach } from 'vitest'

// No need to mock iterNdjson for error paths
import { streamChat } from '@/services/stream-client'

describe('stream-client error paths', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('emits error event when HTTP not ok', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    } as any))

    const events: any[] = []
    const handle = await streamChat('openai', [{ role: 'user', content: 'hi' }], {}, (e) => events.push(e))
    expect(events[0]).toEqual({ type: 'error', error: 'Boom' })
    expect(typeof handle.abort).toBe('function')
  })

  it('emits error when body is missing', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, body: undefined } as any))
    const events: any[] = []
    await streamChat('openai', [{ role: 'user', content: 'hi' }], {}, (e) => events.push(e))
    expect(events[0]).toEqual({ type: 'error', error: 'No response body' })
  })

  // restore fetch after suite
  afterAll(() => {
    global.fetch = originalFetch as any
  })
})

