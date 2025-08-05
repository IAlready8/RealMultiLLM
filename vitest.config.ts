// Fixed Vitest configuration for Next.js 14 App Router compatibility
// Optimized for 8GB RAM environments with proper path resolution

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.tsx'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'out', 'build'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'test', '**/*.d.ts', '.next', 'out']
    },
    // Memory optimization for 8GB RAM machines
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    maxConcurrency: 1,
    // Increase timeout for slower machines
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      // Fix path resolution for Next.js App Router
      '@': resolve(__dirname, '.'),
      '@/app': resolve(__dirname, './app'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/services': resolve(__dirname, './services'),
      '@/test': resolve(__dirname, './test'),
      '@/hooks': resolve(__dirname, './hooks'),
      '@/types': resolve(__dirname, './types'),
    }
  },
  define: {
    // Mock environment variables for tests
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.DATABASE_URL': JSON.stringify('file:./test.db'),
    'process.env.NEXTAUTH_SECRET': JSON.stringify('test-secret'),
    'process.env.NEXTAUTH_URL': JSON.stringify('http://localhost:3000'),
  },
})
