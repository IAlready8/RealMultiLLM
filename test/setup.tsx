// Enhanced test setup for RealMultiLLM
// Optimized for Next.js 14 App Router with comprehensive browser API mocks

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Mock browser APIs and globals
if (typeof window !== 'undefined') {
  // Mock window.matchMedia for next-themes and responsive components
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

  // Mock ResizeObserver for responsive components
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver for lazy loading components
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

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      reload: vi.fn(),
      replace: vi.fn(),
    },
    writable: true,
  });

  // Mock fetch for API calls
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response)
  );
}

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    basePath: '',
    push: vi.fn(() => Promise.resolve(true)),
    replace: vi.fn(() => Promise.resolve(true)),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(() => Promise.resolve()),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
    isLocaleDomain: true,
    isReady: true,
    defaultLocale: 'en',
    domainLocales: [],
    isPreview: false,
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    toString: vi.fn(() => ''),
  }),
  usePathname: () => '/',
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
    update: vi.fn(),
  }),
  signIn: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  getSession: vi.fn(() => Promise.resolve(null)),
  getCsrfToken: vi.fn(() => Promise.resolve('mock-csrf-token')),
  getProviders: vi.fn(() => Promise.resolve({})),
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Increase max listeners to prevent warnings
if (typeof process !== 'undefined') {
  process.setMaxListeners(15);
}
