import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.tsx'],
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 4
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        '.next/**',
        'prisma/**',
        'scripts/**',
        '**/*.test.*',
        '**/*.spec.*',
        '.github/**',
        'install.sh'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        lines: [80, 95]
      }
    },
    // Performance monitoring during tests
    benchmark: {
      outputFile: './coverage/benchmark.json'
    },
    // Test timeout optimized for CI/CD
    testTimeout: 10000,
    hookTimeout: 10000,
    // Memory optimization for 8GB systems
    maxConcurrency: 4,
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'json'] : ['verbose'],
    outputFile: process.env.CI ? './coverage/test-results.json' : undefined,
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  // Optimize for macOS M2 performance
  optimizeDeps: {
    include: ['react', 'react-dom', '@testing-library/react'],
    exclude: ['@prisma/client']
  },
  // Build configuration for tests
  esbuild: {
    target: 'node18'
  }
})