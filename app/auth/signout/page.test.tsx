import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { signOut } from 'next-auth/react'
import SignOutPage from './page'

// Mock next/navigation
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ 
    push: mockPush,
    back: mockBack,
  }),
}))

describe('SignOut Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders signout confirmation correctly', () => {
    render(<SignOutPage />)
    
    expect(screen.getByRole('heading', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to sign out?/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign out$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls signOut and redirects when sign out button is clicked', async () => {
    const user = userEvent.setup()
    const mockSignOut = vi.mocked(signOut)
    mockSignOut.mockResolvedValue(undefined)
    
    render(<SignOutPage />)
    
    const signOutButton = screen.getByRole('button', { name: /^sign out$/i })
    await user.click(signOutButton)
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows loading state during signout', async () => {
    const user = userEvent.setup()
    const mockSignOut = vi.mocked(signOut)
    mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 1000)))
    
    render(<SignOutPage />)
    
    const signOutButton = screen.getByRole('button', { name: /^sign out$/i })
    await user.click(signOutButton)
    
    expect(screen.getByText(/signing out.../i)).toBeInTheDocument()
    expect(signOutButton).toBeDisabled()
  })

  it('navigates back when cancel button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<SignOutPage />)
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)
    
    expect(mockBack).toHaveBeenCalled()
  })

  it('disables buttons during loading', async () => {
    const user = userEvent.setup()
    const mockSignOut = vi.mocked(signOut)
    mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 1000)))
    
    render(<SignOutPage />)
    
    const signOutButton = screen.getByRole('button', { name: /^sign out$/i })
    await user.click(signOutButton)
    
    expect(signOutButton).toBeDisabled()
  })
})