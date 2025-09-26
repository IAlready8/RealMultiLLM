import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as listPersonas } from '@/app/api/personas/route';
import { POST as createPersona } from '@/app/api/personas/route';
import { PUT as updatePersona } from '@/app/api/personas/[id]/route';
import { DELETE as deletePersona } from '@/app/api/personas/[id]/route';
import { mockSession } from '../../test/test-utils';

// Mock Prisma
const mockPersona = {
  id: '1',
  name: 'Test Persona',
  description: 'A test persona',
  instructions: 'You are a helpful assistant',
  userId: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPersonas = [mockPersona];

// Mock the Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    persona: {
      findMany: vi.fn().mockResolvedValue(mockPersonas),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === '1') return mockPersona;
        return null;
      }),
      create: vi.fn().mockResolvedValue(mockPersona),
      update: vi.fn().mockResolvedValue(mockPersona),
      delete: vi.fn().mockResolvedValue(mockPersona),
    },
  },
}));

// Mock NextAuth
vi.mock('next-auth', async () => {
  const actual = await vi.importActual('next-auth');
  return {
    ...actual,
    getServerSession: vi.fn().mockResolvedValue(mockSession),
  };
});

// Mock NextRequest
const createMockRequest = (url: string, options: any = {}) => {
  return {
    url,
    json: vi.fn().mockResolvedValue(options.body || {}),
    headers: {
      get: vi.fn().mockReturnValue(options.headers?.['content-type'] || 'application/json'),
    },
    ...options,
  };
};

describe('Persona Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list all personas for authenticated user', async () => {
    const req = createMockRequest('http://localhost:3000/api/personas');
    const response = await listPersonas(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Test Persona');
  });

  it('should create a new persona', async () => {
    const req = createMockRequest('http://localhost:3000/api/personas', {
      body: {
        name: 'New Persona',
        description: 'A new test persona',
        instructions: 'You are a helpful assistant',
      },
    });

    const response = await createPersona(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Test Persona');
    expect(data.description).toBe('A test persona');
  });

  it('should update an existing persona', async () => {
    const req = createMockRequest('http://localhost:3000/api/personas/1', {
      body: {
        name: 'Updated Persona',
        description: 'An updated test persona',
      },
    });

    const response = await updatePersona(req, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Test Persona');
  });

  it('should delete a persona', async () => {
    const req = createMockRequest('http://localhost:3000/api/personas/1');
    const response = await deletePersona(req, { params: { id: '1' } });

    expect(response.status).toBe(204);
  });
});