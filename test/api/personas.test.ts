import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getServerSession } from 'next-auth/next';

// Mock Prisma
const mockPrisma = {
  persona: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
};

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma
}));

// Mock NextAuth
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock validation and sanitization
vi.mock('@/lib/validation-schemas', () => ({
  validatePersona: vi.fn().mockReturnValue({
    name: 'Test Persona',
    description: 'A test persona',
    systemPrompt: 'You are a helpful assistant'
  })
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePersonaData: vi.fn().mockReturnValue({
    name: 'Test Persona',
    description: 'A test persona'
  })
}));

// Mock error handler and rate limiting
vi.mock('@/lib/error-handler', () => ({
  safeHandleApiError: vi.fn(),
  ErrorCodes: { AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR' },
  createApiError: vi.fn().mockReturnValue({ error: 'Authentication required' })
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true })
}));

// Mock Next.js
vi.mock('next/server', () => ({
  NextRequest: class {
    json = vi.fn();
    url: string;
    headers: Map<string, string>;
    method: string;
    
    constructor(url: string) {
      this.url = url;
      this.method = 'GET';
      this.headers = new Map([
        ['content-type', 'application/json'],
        ['user-agent', 'vitest']
      ]);
      this.json = vi.fn().mockResolvedValue({
        title: 'Test Persona',
        description: 'A test persona',
        prompt: 'You are a helpful assistant'
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

describe('Personas API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authenticated session
    (getServerSession as vi.Mock).mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com' }
    });
  });

  describe('GET /api/personas', () => {
    it('should fetch user personas', async () => {
      const mockPersonas = [
        {
          id: 'persona1',
          title: 'Assistant',
          description: 'Helpful assistant',
          prompt: 'You are helpful',
          userId: 'user1',
          createdAt: new Date()
        }
      ];

      mockPrisma.persona.findMany.mockResolvedValue(mockPersonas);

      const { GET } = await import('@/app/api/personas/route');
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/personas');
      
      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(mockPrisma.persona.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' }
      });
      expect(responseData).toEqual(mockPersonas);
    });

    it('should return unauthorized for unauthenticated users', async () => {
      (getServerSession as vi.Mock).mockResolvedValue(null);

      const { GET } = await import('@/app/api/personas/route');
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/personas');
      
      const response = await GET(mockRequest);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/personas', () => {
    it('should create a new persona', async () => {
      const newPersona = {
        id: 'persona2',
        title: 'Test Persona',
        description: 'A test persona',
        prompt: 'You are a helpful assistant',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.persona.create.mockResolvedValue(newPersona);

      const { POST } = await import('@/app/api/personas/route');
      const mockRequest = new (await import('next/server')).NextRequest('http://localhost/api/personas');
      
      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(mockPrisma.persona.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Persona',
          description: 'A test persona',
          prompt: 'You are a helpful assistant',
          userId: 'user1'
        }
      });
      expect(responseData).toEqual(newPersona);
    });
  });
});
