import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { GET, POST } from '@/app/api/personas/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  default: {
    persona: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from 'next-auth';

describe('Personas API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/personas', () => {
    it('should return unauthorized if there is no session', async () => {
      (getServerSession as Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/personas');
      const response = await GET(req);
      expect(response.status).toBe(401);
    });

    it('should fetch and return user personas for a valid session', async () => {
      const mockSession = { user: { id: 'user-123' } };
      (getServerSession as Mock).mockResolvedValue(mockSession);

      const mockPersonas = [{ id: '1', title: 'Test Persona' }];
      (prisma.persona.findMany as Mock).mockResolvedValue(mockPersonas);

      const req = new NextRequest('http://localhost/api/personas');
      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockPersonas);
      // Corrected expectation to match the actual code
      expect(prisma.persona.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('POST /api/personas', () => {
    it('should return unauthorized if there is no session', async () => {
      (getServerSession as Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/personas', { method: 'POST' });
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should create a new persona for a valid session', async () => {
      const mockSession = { user: { id: 'user-123' } };
      (getServerSession as Mock).mockResolvedValue(mockSession);

      const personaData = { title: 'New Persona', description: 'A new description', prompt: 'Be new.' };
      const createdPersona = { id: '2', ...personaData, userId: 'user-123' };
      (prisma.persona.create as Mock).mockResolvedValue(createdPersona);

      // Correctly mock the request with a JSON body
      const req = new NextRequest('http://localhost/api/personas', {
        method: 'POST',
        body: JSON.stringify(personaData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual(createdPersona);
      expect(prisma.persona.create).toHaveBeenCalledWith({
        data: {
          ...personaData,
          userId: 'user-123',
        },
      });
    });
  });
});
