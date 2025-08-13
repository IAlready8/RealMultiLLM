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
  validatePersona: vi.fn()
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePersonaData: vi.fn()
}));

// Mock error handler and rate limiting
vi.mock('@/lib/error-handler', () => ({
  safeHandleApiError: vi.fn(),
  ErrorCodes: { AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR' },
  createApiError: vi.fn()
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn()
}));

describe('Personas API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authenticated session by default
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

      // Import the route handler
      const { GET } = await import('@/app/api/personas/route');
      
      // Create a mock request
      const mockRequest = {
        url: 'http://localhost/api/personas',
        method: 'GET',
        headers: new Map([['content-type', 'application/json']])
      } as Request;
      
      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(mockPrisma.persona.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' }
      });
      expect(responseData).toEqual(mockPersonas);
    });
  });

  describe('POST /api/personas', () => {
    it('should create a new persona', async () => {
      const mockValidatePersona = (await import('@/lib/validation-schemas')).validatePersona as any;
      const mockSanitizePersonaData = (await import('@/lib/sanitize')).sanitizePersonaData as any;
      const mockCheckRateLimit = (await import('@/lib/rate-limit')).checkRateLimit as any;

      // Setup mocks
      mockCheckRateLimit.mockResolvedValue({ success: true });
      mockValidatePersona.mockReturnValue({
        name: 'Test Persona',
        description: 'A test persona',
        systemPrompt: 'You are a helpful assistant'
      });
      mockSanitizePersonaData.mockReturnValue({
        name: 'Test Persona',
        description: 'A test persona'
      });

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

      // Import the route handler
      const { POST } = await import('@/app/api/personas/route');

      // Create a mock request with JSON body
      const mockRequest = {
        url: 'http://localhost/api/personas',
        method: 'POST',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({
          title: 'Test Persona',
          description: 'A test persona',
          prompt: 'You are a helpful assistant'
        })
      } as Request;
      
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
      expect(response.status).toBe(201);
      expect(responseData).toEqual(newPersona);
    });
  });

  describe('PUT /api/personas', () => {
    it('should update an existing persona', async () => {
      const mockValidatePersona = (await import('@/lib/validation-schemas')).validatePersona as any;
      const mockSanitizePersonaData = (await import('@/lib/sanitize')).sanitizePersonaData as any;

      // Setup mocks
      mockValidatePersona.mockReturnValue({
        name: 'Updated Persona',
        description: 'Updated description',
        systemPrompt: 'You are an updated assistant'
      });
      mockSanitizePersonaData.mockReturnValue({
        name: 'Updated Persona',
        description: 'Updated description'
      });

      const updatedPersona = {
        id: 'persona1',
        title: 'Updated Persona',
        description: 'Updated description',
        prompt: 'You are an updated assistant',
        userId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.persona.update.mockResolvedValue(updatedPersona);

      // Import the route handler
      const { PUT } = await import('@/app/api/personas/route');

      // Create a mock request with JSON body
      const mockRequest = {
        url: 'http://localhost/api/personas',
        method: 'PUT',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({
          id: 'persona1',
          title: 'Updated Persona',
          description: 'Updated description',
          prompt: 'You are an updated assistant'
        })
      } as Request;
      
      const response = await PUT(mockRequest);
      const responseData = await response.json();

      expect(mockPrisma.persona.update).toHaveBeenCalledWith({
        where: {
          id: 'persona1',
          userId: 'user1'
        },
        data: {
          title: 'Updated Persona',
          description: 'Updated description',
          prompt: 'You are an updated assistant'
        }
      });
      expect(response.status).toBe(200);
      expect(responseData).toEqual(updatedPersona);
    });
  });

  describe('DELETE /api/personas', () => {
    it('should delete a persona', async () => {
      mockPrisma.persona.delete.mockResolvedValue({});

      // Import the route handler
      const { DELETE } = await import('@/app/api/personas/route');

      // Create a mock request with query parameters
      const mockRequest = {
        url: 'http://localhost/api/personas?id=persona1',
        method: 'DELETE',
        headers: new Map([['content-type', 'application/json']])
      } as Request;
      
      const response = await DELETE(mockRequest);

      expect(mockPrisma.persona.delete).toHaveBeenCalledWith({
        where: {
          id: 'persona1',
          userId: 'user1'
        }
      });
      expect(response.status).toBe(204);
    });
  });
});