import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as chatPost } from '@/api/llm/chat/route'

// Mock external dependencies
vi.mock('@/lib/llm-api-client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Hello! How can I help you today?',
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
    }),
    validateApiKey: vi.fn().mockResolvedValue(true),
  })),
}))

vi.mock('@/services/conversation-storage', () => ({
  ConversationStorage: vi.fn().mockImplementation(() => ({
    saveConversation: vi.fn().mockResolvedValue('conv-123'),
    getConversation: vi.fn(),
    getAllConversations: vi.fn().mockResolvedValue([]),
  })),
}))

vi.mock('@/services/analytics-service', () => ({
  AnalyticsService: vi.fn().mockImplementation(() => ({
    trackEvent: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('Conversation Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle complete conversation flow', async () => {
    // Step 1: Start a new conversation
    const chatRequest = {
      messages: [
        { role: 'user', content: 'Hello, I need help with JavaScript' }
      ],
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      saveConversation: true,
      conversationTitle: 'JavaScript Help'
    }

    const chatRequestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(chatRequest),
      headers: { 'Content-Type': 'application/json' }
    })

    const chatResponse = await chatPost(chatRequestObj)
    expect(chatResponse.status).toBe(200)

    const chatData = await chatResponse.json()
    expect(chatData).toHaveProperty('content')
    expect(chatData).toHaveProperty('conversationId')

    // Step 2: Continue the conversation
    const followUpRequest = {
      messages: [
        { role: 'user', content: 'Hello, I need help with JavaScript' },
        { role: 'assistant', content: chatData.content },
        { role: 'user', content: 'Can you explain closures?' }
      ],
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      conversationId: chatData.conversationId
    }

    const followUpRequestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(followUpRequest),
      headers: { 'Content-Type': 'application/json' }
    })

    const followUpResponse = await chatPost(followUpRequestObj)
    expect(followUpResponse.status).toBe(200)
  })

  it('should handle provider switching within conversation', async () => {
    // Start with OpenAI
    const openaiRequest = {
      messages: [{ role: 'user', content: 'Explain quantum computing' }],
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      saveConversation: true
    }

    const openaiRequestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(openaiRequest),
      headers: { 'Content-Type': 'application/json' }
    })

    const openaiResponse = await chatPost(openaiRequestObj)
    const openaiData = await openaiResponse.json()

    // Switch to Anthropic
    const anthropicRequest = {
      messages: [
        { role: 'user', content: 'Explain quantum computing' },
        { role: 'assistant', content: openaiData.content },
        { role: 'user', content: 'Can you simplify that explanation?' }
      ],
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      conversationId: openaiData.conversationId
    }

    const anthropicRequestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(anthropicRequest),
      headers: { 'Content-Type': 'application/json' }
    })

    const anthropicResponse = await chatPost(anthropicRequestObj)
    expect(anthropicResponse.status).toBe(200)

    const anthropicData = await anthropicResponse.json()
    expect(anthropicData.conversationId).toBe(openaiData.conversationId)
  })

  it('should handle concurrent conversations', async () => {
    const requests = [
      {
        messages: [{ role: 'user', content: 'Tell me a joke' }],
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        conversationId: 'conv-1'
      },
      {
        messages: [{ role: 'user', content: 'Explain photosynthesis' }],
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        conversationId: 'conv-2'
      },
      {
        messages: [{ role: 'user', content: 'Write a haiku' }],
        provider: 'openai',
        model: 'gpt-4',
        conversationId: 'conv-3'
      }
    ]

    const responses = await Promise.all(
      requests.map(req =>
        chatPost(new NextRequest('http://localhost:3000/api/llm/chat', {
          method: 'POST',
          body: JSON.stringify(req),
          headers: { 'Content-Type': 'application/json' }
        }))
      )
    )

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200)
    })

    // Each should have unique conversation ID
    const responseData = await Promise.all(
      responses.map(res => res.json())
    )

    const conversationIds = responseData.map(data => data.conversationId)
    const uniqueIds = new Set(conversationIds)
    expect(uniqueIds.size).toBe(3)
  })
})