import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUtils, setupTestSuite, TestRequestBuilder } from '../utils/test-framework';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import prisma from '@/lib/prisma';

setupTestSuite();

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    it('should create a new user successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: null,
        image: null,
        password: 'hashedpassword',
        role: 'user',
        twoFactorEnabled: null,
        twoFactorSecret: null,
        twoFactorBackupCodes: null
      });

      const request = new TestRequestBuilder()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!'
        })
        .build();

      const response = await registerHandler(request);
      
      expect(response.status).toBe(201);
      const responseData = await response.json();
      expect(responseData.message).toBe('User created successfully');
    });

    it('should return error for existing user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
        name: 'Existing User',
        password: 'hashedpassword',
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: 'user',
        twoFactorEnabled: null,
        twoFactorSecret: null,
        twoFactorBackupCodes: null
      });

      const request = new TestRequestBuilder()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!'
        })
        .build();
        
      const response = await registerHandler(request);
      const responseData = await response.json();

      expect(responseData.message).toBe('User with this email already exists');
      expect(response.status).toBe(409);
    });

    it('should validate password length', async () => {
      const request = new TestRequestBuilder()
        .setMethod('POST')
        .setBody({
          name: 'Test User',
          email: 'test@example.com',
          password: '123' // Too short
        })
        .build();

      const response = await registerHandler(request);
      const responseData = await response.json();

      expect(responseData.errors[0].message).toBe('Password must be at least 8 characters long');
      expect(response.status).toBe(400);
    });
  });
});
