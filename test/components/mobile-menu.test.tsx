import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileMenu from '@/components/mobile-menu'

// Mock next/link
vi.mock('next/link', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef<HTMLAnchorElement, React.ComponentProps<'a'>>(
      ({ href, children, ...props }: { href?: string; children?: React.ReactNode } & React.ComponentProps<'a'>, ref: React.Ref<HTMLAnchorElement>) => (
        <a ref={ref} href={href as string} {...props}>
          {children}
        </a>
      )
    ),
  }
})

const {
  mockPush,
  usePathnameMock,
  mockSignOut,
  defaultSession,
  useSessionMock,
} = vi.hoisted(() => {
  const session = {
    data: {
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
    },
    status: 'authenticated' as const,
  }

  return {
    mockPush: vi.fn(),
    usePathnameMock: vi.fn(() => '/current-path'),
    mockSignOut: vi.fn(),
    defaultSession: session,
    useSessionMock: vi.fn(() => session),
  }
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: usePathnameMock,
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: useSessionMock,
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: () => <div data-testid="menu-icon" aria-hidden="true">Menu</div>,
  X: () => <div data-testid="close-icon" aria-hidden="true">Close</div>,
  Home: () => <div data-testid="home-icon" aria-hidden="true">Home</div>,
  MessageSquare: () => <div data-testid="chat-icon" aria-hidden="true">Chat</div>,
  Settings: () => <div data-testid="settings-icon" aria-hidden="true">Settings</div>,
  LogOut: () => <div data-testid="logout-icon" aria-hidden="true">Logout</div>,
  User: () => <div data-testid="user-icon" aria-hidden="true">User</div>,
}))

describe('MobileMenu', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    usePathnameMock.mockReturnValue('/current-path')
    useSessionMock.mockReturnValue(defaultSession)
  })

  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    navigationItems: [
      { href: '/', label: 'Home', icon: 'Home' },
      { href: '/chat', label: 'Chat', icon: 'MessageSquare' },
      { href: '/settings', label: 'Settings', icon: 'Settings' },
    ]
  }

  it('should render menu trigger button', () => {
    render(<MobileMenu {...defaultProps} />)

    expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument()
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument()
  })

  it('should call onToggle when trigger is clicked', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} onToggle={onToggle} />)

    const trigger = screen.getByRole('button', { name: /toggle menu/i })
    await user.click(trigger)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('should render navigation items when menu is open', () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByRole('link', { name: /^Home$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Chat$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Settings$/ })).toBeInTheDocument()
  })

  it('should render navigation item icons', () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByTestId('home-icon')).toBeInTheDocument()
    expect(screen.getByTestId('chat-icon')).toBeInTheDocument()
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument()
  })

  it('should handle navigation item clicks', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} isOpen={true} onToggle={onToggle} />)

    const homeLink = screen.getByRole('link', { name: /^Home$/ })
    expect(homeLink).toHaveAttribute('href', '/')

    await user.click(homeLink)

    // Menu should close after navigation
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('should show user info when authenticated', () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should handle sign out', async () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    const signOutButton = screen.getByText('Sign Out')
    await user.click(signOutButton)

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('should highlight active navigation item', () => {
    usePathnameMock.mockReturnValue('/chat')

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    const chatLink = screen.getByRole('link', { name: /^Chat$/ })
    expect(chatLink).toHaveClass('bg-primary')
  })

  it('should handle keyboard navigation', async () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    const links = screen.getAllByRole('link')
    links[0].focus()

    // Tab through items
    await user.keyboard('{Tab}')
    expect(links[1]).toHaveFocus()

    await user.keyboard('{Tab}')
    expect(links[2]).toHaveFocus()
  })

  it('should support custom menu items', () => {
    const customItems = [
      { href: '/custom', label: 'Custom Page', icon: 'User' },
      { href: '/another', label: 'Another Page', icon: 'Settings' }
    ]

    render(<MobileMenu {...defaultProps} navigationItems={customItems} isOpen={true} />)

    expect(screen.getByText('Custom Page')).toBeInTheDocument()
    expect(screen.getByText('Another Page')).toBeInTheDocument()
  })

  it('should handle missing user session gracefully', () => {
    useSessionMock.mockReturnValue({
      data: null,
      status: 'unauthenticated'
    })

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.queryByText('Test User')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
  })

  it('should handle loading session state', () => {
    useSessionMock.mockReturnValue({
      data: null,
      status: 'loading'
    })

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should close menu on outside click', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} isOpen={true} onToggle={onToggle} />)

    await screen.findByRole('dialog')
    const overlay = document.querySelector('[data-state="open"][data-aria-hidden="true"]') as HTMLElement | null
    expect(overlay).not.toBeNull()

    // Simulate clicking outside
    fireEvent.pointerDown(overlay!)
    fireEvent.pointerUp(overlay!)

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(false)
    })
  })

  it('should close menu on escape key', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} isOpen={true} onToggle={onToggle} />)

    await user.keyboard('{Escape}')

    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('should support custom trigger content', () => {
    const customTrigger = <span data-testid="custom-trigger">Custom Menu</span>

    render(<MobileMenu {...defaultProps} trigger={customTrigger} />)

    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('menu-icon')).not.toBeInTheDocument()
  })

  it('should apply custom className', async () => {
    render(<MobileMenu {...defaultProps} isOpen={undefined} className="custom-menu-class" />)

    const trigger = screen.getByRole('button', { name: /toggle menu/i })
    await user.click(trigger)

    const menu = await screen.findByRole('dialog')
    expect(menu.className).toContain('custom-menu-class')
  })
})
