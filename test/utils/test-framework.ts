import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
vi.mock('next-auth');
vi.mock('@/lib/prisma');
vi.mock('@/lib/audit-logger');
vi.mock('@/lib/monitoring');
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { auditLogger } from '@/lib/audit-logger';
import { monitoring } from '@/lib/monitoring';

/**
 * Enterprise testing framework with standardized mocks, fixtures, and utilities
 * Provides consistent testing patterns across the application
 */

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password?: string;
}

export interface TestSession {
  user: TestUser;
  expires: string;
}

export interface TestContext {
  user: TestUser;
  session: TestSession;
  prisma: typeof prisma;
  request: NextRequest;
  response: NextResponse;
}

export interface TestFixtures {
  users: TestUser[];
  conversations: any[];
  providerConfigs: any[];
  analytics: any[];
}

// Test data fixtures
export const testFixtures: TestFixtures = {
  users: [
    {
      id: 'test-user-1',
      name: 'Test User 1',
      email: 'test1@example.com',
      password: 'TestPassword123!'
    },
    {
      id: 'test-user-2',
      name: 'Test User 2',
      email: 'test2@example.com',
      password: 'TestPassword456!'
    },
    {
      id: 'admin-user',
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'AdminPassword789!'
    }
  ],
  conversations: [
    {
      id: 'conv-1',
      userId: 'test-user-1',
      title: 'Test Conversation 1',
      messages: JSON.stringify([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:05:00Z')
    }
  ],
  providerConfigs: [
    {
      id: 'config-1',
      userId: 'test-user-1',
      provider: 'openai',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    }
  ],
  analytics: [
    {
      id: 'analytics-1',
      userId: 'test-user-1',
      action: 'chat_message',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      metadata: JSON.stringify({ provider: 'openai', tokens: 100 })
    }
  ]
};

// Mock implementations
export class TestMocks {
  private static instance: TestMocks;
  private mocks = new Map<string, any>();

  public static getInstance(): TestMocks {
    if (!TestMocks.instance) {
      TestMocks.instance = new TestMocks();
    }
    return TestMocks.instance;
  }

  setupBasicMocks() {
    // Mock environment variables
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-key-for-testing-purposes-only');
    vi.stubEnv('DATABASE_URL', 'file:./test.db');
    vi.stubEnv('ENCRYPTION_MASTER_KEY', 'test-encryption-key-64-characters-long-for-testing-purposes-only12');

    // Mock NextAuth session
    vi.mocked(getServerSession).mockImplementation(async () => {
      return this.getMock('session') || null;
    });

    // Mock Prisma methods
    this.setupPrismaMocks();

    // Mock audit logger
    this.setupAuditLoggerMocks();

    // Mock monitoring
    this.setupMonitoringMocks();
  }

  setupPrismaMocks() {
    // Mock all Prisma model methods
    const models = ['user', 'conversation', 'providerConfig', 'analytics', 'persona', 'goal'];
    
    models.forEach(model => {
      const modelName = model as keyof typeof prisma;
      if (prisma[modelName]) {
        (prisma[modelName] as any).findMany = vi.fn().mockResolvedValue([]);
        (prisma[modelName] as any).findUnique = vi.fn().mockResolvedValue(null);
        (prisma[modelName] as any).findFirst = vi.fn().mockResolvedValue(null);
        (prisma[modelName] as any).create = vi.fn().mockResolvedValue({} as any);
        (prisma[modelName] as any).update = vi.fn().mockResolvedValue({} as any);
        (prisma[modelName] as any).delete = vi.fn().mockResolvedValue({} as any);
        (prisma[modelName] as any).deleteMany = vi.fn().mockResolvedValue({ count: 0 });
        (prisma[modelName] as any).count = vi.fn().mockResolvedValue(0);
      }
    });

    // Mock special Prisma methods
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([]);
    (prisma as any).$executeRaw = vi.fn().mockResolvedValue(0);
    (prisma as any).$transaction = vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn(prisma);
      }
      return Promise.all(fn);
    });
  }

  setupAuditLoggerMocks() {
    vi.mocked(auditLogger.logSecurityEvent).mockResolvedValue();
    vi.mocked(auditLogger.logAuthenticationEvent).mockResolvedValue();
    vi.mocked(auditLogger.logApiKeyEvent).mockResolvedValue();
    vi.mocked(auditLogger.logLlmInteraction).mockResolvedValue();
    vi.mocked(auditLogger.logDataAccess).mockResolvedValue();
    vi.mocked(auditLogger.logDataModification).mockResolvedValue();
    vi.mocked(auditLogger.logConfigurationChange).mockResolvedValue();
  }

  setupMonitoringMocks() {
    vi.mocked(monitoring.recordMetric).mockImplementation(() => {});
    vi.mocked(monitoring.recordRequest).mockImplementation(() => {});
    vi.mocked(monitoring.recordLlmMetrics).mockImplementation(() => {});
    vi.mocked(monitoring.recordDatabaseMetrics).mockImplementation(() => {});
    vi.mocked(monitoring.createPerformanceMonitor).mockImplementation(() => ({
      finish: vi.fn().mockReturnValue(100)
    }));
  }

  setMock(key: string, value: any) {
    this.mocks.set(key, value);
  }

  getMock(key: string) {
    return this.mocks.get(key);
  }

  clearMocks() {
    this.mocks.clear();
  }

  // Utility methods for setting up common test scenarios
  mockAuthenticatedUser(user: TestUser = testFixtures.users[0]) {
    const session: TestSession = {
      user,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    this.setMock('session', session);
    this.setMock('user', user);
    
    return { user, session };
  }

  mockUnauthenticated() {
    this.setMock('session', null);
    this.setMock('user', null);
  }

  mockDatabaseData(model: string, data: any[]) {
    const mockModel = (prisma as any)[model as keyof typeof prisma] as any;
    if (mockModel) {
      vi.mocked(mockModel.findMany).mockResolvedValue(data as any);
      if (data.length > 0) {
        vi.mocked(mockModel.findUnique).mockResolvedValue(data[0] as any);
        vi.mocked(mockModel.findFirst).mockResolvedValue(data[0] as any);
      } else {
        vi.mocked(mockModel.findUnique).mockResolvedValue(null as any);
        vi.mocked(mockModel.findFirst).mockResolvedValue(null as any);
      }
    }
  }

  mockDatabaseError(model: string, method: string, error: Error) {
    const mockModel = (prisma as any)[model as keyof typeof prisma] as any;
    if (mockModel && mockModel[method as any]) {
      vi.mocked(mockModel[method as any] as any).mockRejectedValue(error);
    }
  }
}

// Request/Response utilities
export class TestRequestBuilder {
  private method: string = 'GET';
  private url: string = 'http://localhost:3000';
  private headers: Record<string, string> = {};
  private body?: any;
  private cookies: Record<string, string> = {};

  static create(): TestRequestBuilder {
    return new TestRequestBuilder();
  }

  setMethod(method: string): TestRequestBuilder {
    this.method = method;
    return this;
  }

  setUrl(url: string): TestRequestBuilder {
    this.url = url;
    return this;
  }

  setHeader(key: string, value: string): TestRequestBuilder {
    this.headers[key] = value;
    return this;
  }

  setHeaders(headers: Record<string, string>): TestRequestBuilder {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  setBody(body: any): TestRequestBuilder {
    this.body = body;
    if (typeof body === 'object') {
      this.setHeader('content-type', 'application/json');
    }
    return this;
  }

  setCookie(key: string, value: string): TestRequestBuilder {
    this.cookies[key] = value;
    return this;
  }

  setAuth(token: string): TestRequestBuilder {
    this.setHeader('authorization', `Bearer ${token}`);
    return this;
  }

  build(): NextRequest {
    const cookieString = Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    if (cookieString) {
      this.headers.cookie = cookieString;
    }

    const requestInit: RequestInit = {
      method: this.method,
      headers: this.headers
    };

    if (this.body) {
      requestInit.body = typeof this.body === 'string' 
        ? this.body 
        : JSON.stringify(this.body);
    }

    return new NextRequest(this.url, requestInit as any);
  }
}

// Test assertions
export class TestAssertions {
  static async expectJsonResponse(
    response: NextResponse,
    expectedStatus: number,
    expectedBody?: any
  ) {
    expect(response.status).toBe(expectedStatus);
    
    const body = await response.json();
    if (expectedBody) {
      expect(body).toMatchObject(expectedBody);
    }
    
    return body;
  }

  static expectHeaders(response: NextResponse, expectedHeaders: Record<string, string>) {
    Object.entries(expectedHeaders).forEach(([key, value]) => {
      expect(response.headers.get(key)).toBe(value);
    });
  }

  static expectSecurityHeaders(response: NextResponse) {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy'
    ];

    requiredHeaders.forEach(header => {
      expect(response.headers.has(header)).toBe(true);
    });
  }

  static expectAuditLog(action: string, outcome: 'success' | 'failure' | 'warning') {
    expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
      action,
      outcome,
      expect.any(Object),
      expect.any(Object),
      expect.any(String)
    );
  }

  static expectMetricRecorded(metricName: string, value?: number) {
    if (value !== undefined) {
      expect(monitoring.recordMetric).toHaveBeenCalledWith(
        metricName,
        value,
        expect.any(Object),
        expect.any(String)
      );
    } else {
      expect(monitoring.recordMetric).toHaveBeenCalledWith(
        expect.stringContaining(metricName),
        expect.any(Number),
        expect.any(Object),
        expect.any(String)
      );
    }
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureApiResponse(
    apiCall: () => Promise<NextResponse>,
    expectedMaxTime: number = 1000
  ): Promise<{ response: NextResponse; duration: number }> {
    const startTime = Date.now();
    const response = await apiCall();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(expectedMaxTime);
    
    return { response, duration };
  }

  static async loadTest(
    apiCall: () => Promise<NextResponse>,
    concurrency: number = 10,
    iterations: number = 100
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  }> {
    const results: { success: boolean; duration: number }[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          for (let j = 0; j < Math.ceil(iterations / concurrency); j++) {
            const startTime = Date.now();
            try {
              await apiCall();
              results.push({
                success: true,
                duration: Date.now() - startTime
              });
            } catch (error) {
              results.push({
                success: false,
                duration: Date.now() - startTime
              });
            }
          }
        })()
      );
    }

    await Promise.all(promises);

    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);

    return {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: results.length - successfulResults.length,
      avgResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      maxResponseTime: Math.max(...durations),
      minResponseTime: Math.min(...durations)
    };
  }
}

// Database test utilities
export class DatabaseTestUtils {
  static async seedTestData() {
    const mocks = TestMocks.getInstance();
    
    // Mock database with fixture data
    mocks.mockDatabaseData('user', testFixtures.users);
    mocks.mockDatabaseData('conversation', testFixtures.conversations);
    mocks.mockDatabaseData('providerConfig', testFixtures.providerConfigs);
    mocks.mockDatabaseData('analytics', testFixtures.analytics);
  }

  static async cleanupTestData() {
    // In a real implementation, this would clean up test database
    // For mocked tests, we just clear the mocks
    const mocks = TestMocks.getInstance();
    mocks.clearMocks();
  }

  static mockTransactionSuccess() {
    vi.mocked(prisma.$transaction).mockImplementation(async (operations: any) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      return operations(prisma);
    });
  }

  static mockTransactionFailure(error: Error) {
    vi.mocked(prisma.$transaction).mockRejectedValue(error);
  }
}

// Test suite setup helpers
export function setupTestSuite() {
  const mocks = TestMocks.getInstance();
  
  beforeEach(() => {
    mocks.setupBasicMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mocks.clearMocks();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
}

// Export test utilities
export const testUtils = {
  mocks: TestMocks.getInstance(),
  request: TestRequestBuilder,
  assert: TestAssertions,
  performance: PerformanceTestUtils,
  database: DatabaseTestUtils
};

// Common test patterns
export function createApiTest(
  name: string,
  apiHandler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    authenticated?: boolean;
    expectedStatus?: number;
    expectedBody?: any;
    setup?: () => void | Promise<void>;
    teardown?: () => void | Promise<void>;
  } = {}
) {
  return it(name, async () => {
    if (options.setup) {
      await options.setup();
    }

    if (options.authenticated !== false) {
      testUtils.mocks.mockAuthenticatedUser();
    } else {
      testUtils.mocks.mockUnauthenticated();
    }

    const request = TestRequestBuilder.create()
      .setMethod('POST')
      .setUrl('http://localhost:3000/api/test')
      .setBody({ test: 'data' })
      .build();

    const response = await apiHandler(request);

    await TestAssertions.expectJsonResponse(
      response,
      options.expectedStatus || 200,
      options.expectedBody
    );

    TestAssertions.expectSecurityHeaders(response);

    if (options.teardown) {
      await options.teardown();
    }
  });
}
