// Import test setup utilities
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers);

// Mock browser APIs not available in test environment
if (typeof window !== 'undefined') {
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
