import { beforeAll, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Performance monitoring setup for tests
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_MS: 100,
  MEMORY_LIMIT_MB: 6144, // 6GB for 8GB MacBook Air M2
  API_TIMEOUT_MS: 5000
};

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';

// Performance monitoring
let performanceStartTime: number;
let testStartTime: number;

beforeAll(() => {
  // Setup global test environment
  global.performance.mark = vi.fn();
  global.performance.measure = vi.fn();
  
  // Mock Next.js router
  vi.mock('next/router', () => ({
    useRouter: () => ({
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: vi.fn(),
      pop: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      },
    }),
  }));

  // Mock Next.js navigation
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    useSearchParams: () => ({
      get: vi.fn(),
    }),
    usePathname: () => '/',
  }));

  // Mock NextAuth
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
      status: 'authenticated',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  // Mock Prisma client
  vi.mock('@/lib/prisma', () => ({
    default: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      conversation: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      message: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      persona: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }));

  // Mock LLM API clients
  vi.mock('@/services/api-client', () => ({
    callLLM: vi.fn().mockResolvedValue({
      content: 'Mock LLM response',
      usage: { total_tokens: 100 },
      model: 'gpt-4',
      latency: 150,
    }),
  }));

  // Mock secure storage
  vi.mock('@/lib/secure-storage', () => ({
    secureStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
  }));

  // Mock crypto utilities
  vi.mock('@/lib/crypto', () => ({
    encrypt: vi.fn().mockReturnValue('encrypted-data'),
    decrypt: vi.fn().mockReturnValue('decrypted-data'),
    hash: vi.fn().mockReturnValue('hashed-data'),
  }));

  // Performance optimization for tests
  global.console = {
    ...console,
    // Suppress non-essential logs during testing
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: console.warn, // Keep warnings
    error: console.error, // Keep errors
  };
});

beforeEach(() => {
  testStartTime = performance.now();
  
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Mock fetch for API calls
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {},
    }),
    text: async () => 'Mock response',
  });

  // Mock window.matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Performance monitoring setup
  performanceStartTime = performance.now();
});

afterEach(() => {
  cleanup();
  
  // Performance monitoring after each test
  const testDuration = performance.now() - testStartTime;
  
  // Log slow tests for optimization
  if (testDuration > PERFORMANCE_THRESHOLDS.RENDER_TIME_MS) {
    console.warn(`⚠️ Slow test detected: ${testDuration.toFixed(2)}ms`);
  }
  
  // Memory usage check (mock implementation)
  if (typeof performance.memory !== 'undefined') {
    const memoryUsage = performance.memory.usedJSHeapSize / (1024 * 1024); // MB
    if (memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_LIMIT_MB / 4) {
      console.warn(`⚠️ High memory usage: ${memoryUsage.toFixed(2)}MB`);
    }
  }
});

// Global test utilities
global.testUtils = {
  PERFORMANCE_THRESHOLDS,
  
  // Simulate API latency for realistic testing
  simulateAPILatency: (ms: number = 100) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Generate mock LLM response
  mockLLMResponse: (content: string = 'Mock response') => ({
    content,
    usage: { total_tokens: Math.floor(Math.random() * 200) + 50 },
    model: 'gpt-4',
    latency: Math.floor(Math.random() * 1000) + 100,
  }),
  
  // Mock conversation data
  mockConversation: (id: string = 'test-conversation') => ({
    id,
    title: 'Test Conversation',
    userId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  }),
  
  // Mock user data
  mockUser: (id: string = 'test-user') => ({
    id,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  
  // Performance assertion helper
  assertPerformance: (operation: () => void, maxTime: number = PERFORMANCE_THRESHOLDS.RENDER_TIME_MS) => {
    const start = performance.now();
    operation();
    const duration = performance.now() - start;
    
    if (duration > maxTime) {
      throw new Error(`Performance assertion failed: ${duration.toFixed(2)}ms > ${maxTime}ms`);
    }
    
    return duration;
  },
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    PERFORMANCE_THRESHOLDS: typeof PERFORMANCE_THRESHOLDS;
    simulateAPILatency: (ms?: number) => Promise<void>;
    mockLLMResponse: (content?: string) => any;
    mockConversation: (id?: string) => any;
    mockUser: (id?: string) => any;
    assertPerformance: (operation: () => void, maxTime?: number) => number;
  };
  
  interface Window {
    matchMedia: any;
  }
}

export {};