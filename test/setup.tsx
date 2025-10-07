import '@testing-library/jest-dom'
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test case
afterEach(() => {
  cleanup()
})

// Mock Next.js request storage for API route tests
beforeAll(() => {
  // Mock next-auth/react
  global.fetch = global.fetch || fetch
  
  // Mock window.matchMedia for next-themes
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
  })
  
  // Mock Next.js AsyncLocalStorage for headers/cookies in API routes
  // This prevents "headers was called outside a request scope" errors
  vi.mock('next/server', async () => {
    const actual = await vi.importActual<typeof import('next/server')>('next/server')
    return {
      ...actual,
      NextRequest: actual.NextRequest,
      NextResponse: actual.NextResponse,
    }
  })
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
