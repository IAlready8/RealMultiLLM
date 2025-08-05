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
    threads: false, // Disable threading for more stable tests on limited RAM
    maxConcurrency: 1, // Run tests sequentially to avoid memory issues
    maxWorkers: 1, // Limit to 1 worker for smaller memory footprint
    minThreads: 1,
    isolate: false, // Disable isolation to reduce memory overhead
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './app'),
      '@components': resolve(__dirname, './components'),
      '@lib': resolve(__dirname, './lib'),
      '@services': resolve(__dirname, './services'),
    }
  },
})
