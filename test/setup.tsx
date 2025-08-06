// Import test setup utilities
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
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

  // Mock matchMedia for next-themes
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
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

  // Mock ResizeObserver
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

// Clean up after each test
afterEach(() => {
  cleanup();
});
