import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as registerPost } from '@/api/auth/register/route'
import { POST as chatPost } from '@/api/llm/chat/route'

// Mock dependencies
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/llm-api-client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Hello! How can I help you?',
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 }
    }),
  })),
}))

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle complete user registration and authentication flow', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { getServerSession } = await import('next-auth')

    // Step 1: Register new user
    const userData = {
      email: 'test@example.com',
      password: 'securePassword123',
      name: 'Test User'
    }

    const createdUser = {
      id: 'user-123',
      email: userData.email,
      name: userData.name,
      hashedPassword: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Mock user doesn't exist
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue(createdUser)

    const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      headers: { 'Content-Type': 'application/json' }
    })

    const registerResponse = await registerPost(registerRequest)
    expect(registerResponse.status).toBe(201)

    const registerData = await registerResponse.json()
    expect(registerData.message).toBe('User created successfully')
    expect(registerData.user.email).toBe(userData.email)

    // Step 2: Simulate authenticated session
    const mockSession = {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    // @ts-ignore
    getServerSession.mockResolvedValue(mockSession)

    // Step 3: Make authenticated API call
    const chatRequest = {
      messages: [{ role: 'user', content: 'Hello, I am the newly registered user' }],
      provider: 'openai',
      model: 'gpt-3.5-turbo'
    }

    const chatRequestObj = new NextRequest('http://localhost:3000/api/llm/chat', {
      method: 'POST',
      body: JSON.stringify(chatRequest),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-session-token'
      }
    })

    const chatResponse = await chatPost(chatRequestObj)
    expect(chatResponse.status).toBe(200)

    const chatData = await chatResponse.json()
    expect(chatData).toHaveProperty('content')
  })

  it('should prevent duplicate user registration', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const userData = {
      email: 'existing@example.com',
      password: 'password123',
      name: 'Existing User'
    }

    const existingUser = {
      id: 'existing-123',
      email: userData.email,
      name: 'Previous Name',
      hashedPassword: 'old_hash'
    }

    // Mock user already exists
    prisma.user.findUnique.mockResolvedValue(existingUser)

    const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      headers: { 'Content-Type': 'application/json' }
    })

    const registerResponse = await registerPost(registerRequest)
    expect(registerResponse.status).toBe(400)

    const responseData = await registerResponse.json()
    expect(responseData.error).toBe('User already exists')

    // Verify user creation was not attempted
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('should handle concurrent authentication requests', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const users = [
      { email: 'user1@example.com', password: 'password123', name: 'User 1' },
      { email: 'user2@example.com', password: 'password123', name: 'User 2' },
      { email: 'user3@example.com', password: 'password123', name: 'User 3' }
    ]

    // Mock database responses
    prisma.user.findUnique.mockResolvedValue(null) // No existing users
    prisma.user.create.mockImplementation((data) =>
      Promise.resolve({
        id: `user-${Date.now()}`,
        email: data.data.email,
        name: data.data.name,
        hashedPassword: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    const registrationPromises = users.map(userData =>
      registerPost(new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      }))
    )

    const responses = await Promise.all(registrationPromises)

    // All registrations should succeed
    responses.forEach(response => {
      expect(response.status).toBe(201)
    })

    // Verify all users were created
    expect(prisma.user.create).toHaveBeenCalledTimes(3)
  })
})