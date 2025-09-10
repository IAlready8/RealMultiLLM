import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { signIn } from 'next-auth/react'
import SignInPage from './page'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('SignIn Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders signin form correctly', () => {
    render(<SignInPage />, { session: null })
    
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/sign in to your account to access your conversations/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows demo credentials', () => {
    render(<SignInPage />, { session: null })
    
    expect(screen.getByText(/demo@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/DemoPassword123!@#/)).toBeInTheDocument()
  })

  it('has Google and GitHub sign-in buttons', () => {
    render(<SignInPage />, { session: null })
    
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<SignInPage />, { session: null })
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    // Should not submit without email and password
    expect(signIn).not.toHaveBeenCalled()
  })

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' })
    
    render(<SignInPage />, { session: null })
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        redirect: false,
        email: 'test@example.com',
        password: 'password123',
        callbackUrl: '/',
      })
    })
  })

  it('displays error message on failed signin', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin', ok: false, status: 401, url: null })
    
    render(<SignInPage />, { session: null })
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during signin', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null, ok: true, status: 200, url: '/' }), 1000)))
    
    render(<SignInPage />, { session: null })
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    expect(screen.getByText(/signing in.../i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('calls Google signin when Google button is clicked', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    
    render(<SignInPage />, { session: null })
    
    const googleButton = screen.getByRole('button', { name: /google/i })
    await user.click(googleButton)
    
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/' })
  })

  it('calls GitHub signin when GitHub button is clicked', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    
    render(<SignInPage />, { session: null })
    
    const githubButton = screen.getByRole('button', { name: /github/i })
    await user.click(githubButton)
    
    expect(mockSignIn).toHaveBeenCalledWith('github', { callbackUrl: '/' })
  })

  it('redirects to callback URL on successful signin', async () => {
    const user = userEvent.setup()
    const mockSignIn = vi.mocked(signIn)
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: '/' })
    
    render(<SignInPage />, { session: null })
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
