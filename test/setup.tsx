
// Import test setup utilities
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Mock browser APIs not available in test environment
if (typeof window !== 'undefined') {
  console.log("Running test/setup.tsx in browser environment.");
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn().mockImplementation(() => this), // Deprecated
      removeListener: vi.fn().mockImplementation(() => this), // Deprecated
      addEventListener: vi.fn().mockImplementation(() => this),
      removeEventListener: vi.fn().mockImplementation(() => this),
      dispatchEvent: vi.fn(),
    })),
  });

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

  // Mock indexedDB
  if (!window.indexedDB) {
    Object.defineProperty(window, 'indexedDB', {
      writable: true,
      value: {
        open: vi.fn(() => ({
          // Mock a simple IDBDatabase object
          createObjectStore: vi.fn(),
          transaction: vi.fn(() => ({
            objectStore: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve(undefined)),
              put: vi.fn(() => Promise.resolve(undefined)),
              delete: vi.fn(() => Promise.resolve(undefined)),
              getAll: vi.fn(() => ({
                onsuccess: null,
                onerror: null,
                result: [],
              })),
              getAllKeys: vi.fn(() => Promise.resolve([])),
              count: vi.fn(() => Promise.resolve(0)),
            })),
            commit: vi.fn(),
            abort: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          })),
          close: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
        deleteDatabase: vi.fn(() => Promise.resolve(undefined)),
      },
    });
  }

  // Mock ResizeObserver
  if (typeof window !== 'undefined' && !window.ResizeObserver) {
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
}

// Mock Next.js server functions
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map([
    ['user-agent', 'vitest'],
    ['x-forwarded-for', '127.0.0.1']
  ]))
}));

// Mock global crypto for Node.js environment
if (typeof global !== 'undefined' && !global.crypto) {
  const { webcrypto } = require('node:crypto');
  global.crypto = webcrypto as any;
}

// Clean up after each test
afterEach(() => {
  cleanup();
});
