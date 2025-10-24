import '@testing-library/jest-dom'
import { beforeAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { webcrypto } from 'crypto';

// Polyfill Web Crypto API for test environment
if (typeof global.crypto === 'undefined') {
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}

// Polyfill URL for NextRequest in JSDOM environment
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}


// Cleanup after each test case
afterEach(() => {
  cleanup()
})

// Mock next-auth
beforeAll(() => {
  // Mock next-auth/react
  global.fetch = global.fetch || fetch
})

// Mock performance API for test environment
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
  }
})

// Mock Next.js router
const mockRouter = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => Promise.resolve(true),
  replace: () => Promise.resolve(true),
  prefetch: () => Promise.resolve(),
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
  basePath: '',
  isLocaleDomain: false,
  isReady: true,
  defaultLocale: 'en',
  domainLocales: [],
  isPreview: false,
}

const mockUseRouter = () => mockRouter
const mockUsePathname = () => '/'
const mockUseSearchParams = () => new URLSearchParams()

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: mockUseRouter,
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
}))

// Mock Next.js headers and cookies
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name) => {
      if (name === 'x-forwarded-for') {
        return '127.0.0.1'; // Mock IP address for rate limiting tests
      }
      return null;
    }),
  })),
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
  })),
}));

// Mock next-auth
vi.mock('next-auth/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth/react')>()
  return {
    ...actual,
    useSession: () => ({
      data: null,
      status: 'unauthenticated',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock the Slider component to avoid ResizeObserver errors
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: { value: number[], onValueChange: (value: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      {...props}
    />
  ),
}));

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});