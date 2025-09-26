import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import AuthGuard from '@/components/auth-guard'

// Mock next-auth
const mockUseSession = vi.fn()

vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual('next-auth/react')
  return {
    ...actual,
    useSession: () => mockUseSession(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
})

// Mock router
const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  usePathname: () => '/protected-route',
}))

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const TestComponent = () => <div data-testid="protected-content">Protected Content</div>

  it('should render children when user is authenticated', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        expires: '2024-12-31'
      },
      status: 'authenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should redirect to signin when user is not authenticated', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('should show loading state while authentication status is loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should redirect with return URL when provided', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard redirectTo="/custom-signin" returnUrl="/dashboard">
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/custom-signin?callbackUrl=%2Fdashboard')
    })
  })

  it('should render custom loading component', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading'
    })

    const CustomLoader = () => <div data-testid="custom-loader">Custom Loading...</div>

    render(
      <SessionProvider session={null}>
        <AuthGuard loadingComponent={<CustomLoader />}>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    expect(screen.getByTestId('custom-loader')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('should handle role-based access control', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', email: 'user@example.com', name: 'Regular User', role: 'user' },
        expires: '2024-12-31'
      },
      status: 'authenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard requiredRole="admin">
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/unauthorized')
    })

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('should allow access for users with correct role', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
        expires: '2024-12-31'
      },
      status: 'authenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard requiredRole="admin">
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should handle session expiry', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        expires: new Date(Date.now() - 1000).toISOString() // Expired
      },
      status: 'authenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard checkExpiry>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })
  })

  it('should respect custom unauthorized redirect', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '1', email: 'user@example.com', name: 'Regular User', role: 'user' },
        expires: '2024-12-31'
      },
      status: 'authenticated'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard requiredRole="admin" unauthorizedRedirect="/access-denied">
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/access-denied')
    })
  })

  it('should handle authentication errors gracefully', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'authenticated', // Inconsistent state
      error: 'Authentication error'
    })

    render(
      <SessionProvider session={null}>
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })
  })
})