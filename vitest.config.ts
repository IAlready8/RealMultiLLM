import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.tsx'],
    globals: true,
    env: {
      NODE_ENV: 'test',
      NEXTAUTH_SECRET: 'test-secret-key-for-testing-purposes-only-32-characters',
      DATABASE_URL: 'file:./test.db',
      ENCRYPTION_MASTER_KEY: 'test-encryption-key-64-characters-long-for-testing-purposes-only123456789012',
      ALLOW_DEMO_MODE: 'true'
    },
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      'test/e2e/**',
    ],
    // Reduce flakiness in CI runners; can be overridden via CLI flags
    pool: process.env.CI ? 'forks' : 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        '.next/**',
        'prisma/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
