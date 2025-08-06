// Import test setup utilities
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Mock browser APIs not available in test environment
if (typeof window !== 'undefined') {
  // Mock matchMedia for next-themes
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

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock the Web Crypto API
  if (!window.crypto) {
    Object.defineProperty(window, 'crypto', {
      value: {
        getRandomValues: (buffer: Uint8Array) => {
          for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
          }
          return buffer;
        },
        subtle: {
          digest: async (algorithm: string, data: BufferSource) => {
            return new ArrayBuffer(32); // Mock digest return
          },
          encrypt: async (algorithm: any, key: any, data: BufferSource) => {
            return new ArrayBuffer(data.byteLength + 16); // Mock encrypted data
          },
          decrypt: async (algorithm: any, key: any, data: BufferSource) => {
            return new ArrayBuffer(Math.max(0, data.byteLength - 16)); // Mock decrypted data
          },
          importKey: async () => ({}),
          deriveKey: async () => ({})
        }
      }
    });
  }

  // Mock localStorage
  if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] || null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value.toString();
        },
        removeItem(key: string) {
          delete this.store[key];
        },
        clear() {
          this.store = {};
        }
      }
    });
  }

  // Mock sessionStorage
  if (!window.sessionStorage) {
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] || null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value.toString();
        },
        removeItem(key: string) {
          delete this.store[key];
        },
        clear() {
          this.store = {};
        }
      }
    });
  }
}

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      },
      expires: new Date(Date.now() + 2 * 86400).toISOString(),
    },
    status: 'authenticated',
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    persona: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    goal: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    analytics: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Increase max listeners to prevent warnings
process.setMaxListeners(20);
