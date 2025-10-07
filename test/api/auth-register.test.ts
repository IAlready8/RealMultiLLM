import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from '@/api/auth/register/route'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}))

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  }
}))

// Import mocked modules
import prisma from '@/lib/prisma'

describe('/api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'test@example.com',
        password: 'securePassword123',
        name: 'Test User'
      }

      const hashedPassword = 'hashed_password_123'
      const createdUser = {
        id: 'user-123',
        email: newUser.email,
        name: newUser.name,
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock bcrypt.hash
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword)

      // Mock database operations
      vi.mocked(prisma.user).findUnique.mockResolvedValue(null) // User doesn't exist
      vi.mocked(prisma.user).create.mockResolvedValue(createdUser)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data).toHaveProperty('message', 'User created successfully')
      expect(data).toHaveProperty('user')
      expect(data.user).not.toHaveProperty('hashedPassword')

      expect(vi.mocked(prisma.user).findUnique).toHaveBeenCalledWith({
        where: { email: newUser.email }
      })
      expect(bcrypt.hash).toHaveBeenCalledWith(newUser.password, 12)
      expect(vi.mocked(prisma.user).create).toHaveBeenCalledWith({
        data: {
          email: newUser.email,
          name: newUser.name,
          hashedPassword
        }
      })
    })

    it('should reject registration with existing email', async () => {
      const existingUser = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      }

      const mockExistingUser = {
        id: 'existing-123',
        email: existingUser.email,
        name: 'Previous User',
        hashedPassword: 'old_hash'
      }

      vi.mocked(prisma.user).findUnique.mockResolvedValue(mockExistingUser)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(existingUser),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toHaveProperty('error', 'User already exists')
      expect(vi.mocked(prisma.user).create).not.toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const invalidUsers = [
        { email: '', password: 'password123', name: 'Test' }, // Empty email
        { email: 'test@example.com', password: '', name: 'Test' }, // Empty password
        { email: 'test@example.com', password: 'password123', name: '' }, // Empty name
        { password: 'password123', name: 'Test' }, // Missing email
        { email: 'test@example.com', name: 'Test' }, // Missing password
        { email: 'test@example.com', password: 'password123' }, // Missing name
      ]

      for (const invalidUser of invalidUsers) {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(invalidUser),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await POST(request)

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        'invalid@',
        '@domain.com',
        'spaces in@email.com',
        'multiple@@signs.com'
      ]

      for (const email of invalidEmails) {
        const userData = {
          email,
          password: 'validPassword123',
          name: 'Test User'
        }

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await POST(request)

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('email')
      }
    })

    it('should validate password strength', async () => {
      const weakPasswords = [
        '123', // Too short
        'password', // No numbers/special chars
        '12345678', // Only numbers
        'abcdefgh', // Only letters
        'Pass1', // Too short but mixed
      ]

      for (const password of weakPasswords) {
        const userData = {
          email: 'test@example.com',
          password,
          name: 'Test User'
        }

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData),
          headers: { 'Content-Type': 'application/json' }
        })

        const response = await POST(request)

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('password')
      }
    })

    it('should handle database errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securePassword123',
        name: 'Test User'
      }

      vi.mocked(prisma.user).findUnique.mockRejectedValue(new Error('Database connection error'))

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toHaveProperty('error', 'Internal server error')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toHaveProperty('error')
    })

    it('should sanitize input data', async () => {
      const userData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'securePassword123',
        name: '  Test User  '
      }

      const hashedPassword = 'hashed_password_123'
      const createdUser = {
        id: 'user-123',
        email: 'test@example.com', // Should be normalized
        name: 'Test User', // Should be trimmed
        hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword)
      vi.mocked(prisma.user).findUnique.mockResolvedValue(null)
      vi.mocked(prisma.user).create.mockResolvedValue(createdUser)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(vi.mocked(prisma.user).findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
      expect(vi.mocked(prisma.user).create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          hashedPassword
        }
      })
    })
  })
})