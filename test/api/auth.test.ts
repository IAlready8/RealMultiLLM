import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  }
};

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashedPassword123'),
    compare: vi.fn().mockResolvedValue(true)
  }
}));

// Mock Next.js
vi.mock('next/server', () => ({
  NextRequest: class {
    json = vi.fn();
    constructor(url: string, options?: any) {
      this.json = vi.fn().mockResolvedValue({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
    }
  },
  NextResponse: {
    json: vi.fn().mockImplementation((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200
    }))
  }
}));

describe('Authentication API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should create a new user successfully', async () => {
      // Mock successful user creation
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date()
      });

      // Import and test the API route
      const { POST } = await import('@/app/api/auth/register/route');
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/auth/register');
      
      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(responseData.message).toBe('User created successfully');
    });

    it('should return error for existing user', async () => {
      // Mock existing user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/auth/register');
      
      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(responseData.message).toBe('User with this email already exists');
      expect(response.status).toBe(409);
    });

    it('should validate password length', async () => {
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/auth/register');
      mockRequest.json = vi.fn().mockResolvedValue({
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Too short
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(responseData.message).toBe('Password must be at least 6 characters long');
      expect(response.status).toBe(400);
    });
  });
});