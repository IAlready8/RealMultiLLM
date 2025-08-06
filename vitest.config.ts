// 3-STEP PLAN:
// 1. Configure Vitest to work properly with Next.js
// 2. Set up test environment for both client and server components
// 3. Optimize for performance on limited hardware

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
    exclude: ['node_modules', '.next', 'out'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'test', '**/*.d.ts']
    },
    pool: 'forks', // Use forks instead of threads for better stability
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork for memory constraints
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/app': resolve(__dirname, './app'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/services': resolve(__dirname, './services'),
      '@/hooks': resolve(__dirname, './hooks'),
      '@/test': resolve(__dirname, './test'),
      '@/types': resolve(__dirname, './types'),
      '@/prisma': resolve(__dirname, './prisma'),
    }
  },
})
