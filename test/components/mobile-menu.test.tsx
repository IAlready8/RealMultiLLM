import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileMenu from '@/components/mobile-menu'

// Mock Radix UI components
vi.mock('@radix-ui/react-sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
  SheetTrigger: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    <button data-testid="sheet-trigger" onClick={onClick}>{children}</button>,
  SheetContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="sheet-title">{children}</h2>,
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...props}>{children}</a>
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/current-path',
}))

// Mock next-auth
const mockSignOut = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: '1', email: 'test@example.com', name: 'Test User' }
    },
    status: 'authenticated'
  }),
  signOut: mockSignOut,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  X: () => <div data-testid="close-icon">Close</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  MessageSquare: () => <div data-testid="chat-icon">Chat</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  LogOut: () => <div data-testid="logout-icon">Logout</div>,
  User: () => <div data-testid="user-icon">User</div>,
}))

describe('MobileMenu', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(screen.getByTestId('sheet-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument()
  })

  it('should call onToggle when trigger is clicked', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} onToggle={onToggle} />)

    const trigger = screen.getByTestId('sheet-trigger')
    await user.click(trigger)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('should render navigation items when menu is open', () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
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

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveAttribute('href', '/')

    await user.click(homeLink!)

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
    vi.mocked(require('next/navigation').usePathname).mockReturnValue('/chat')

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    const chatLink = screen.getByText('Chat').closest('a')
    expect(chatLink).toHaveClass('bg-primary')
  })

  it('should handle keyboard navigation', async () => {
    render(<MobileMenu {...defaultProps} isOpen={true} />)

    const firstItem = screen.getByText('Home')
    firstItem.focus()

    // Tab through items
    await user.keyboard('{Tab}')
    expect(screen.getByText('Chat')).toHaveFocus()

    await user.keyboard('{Tab}')
    expect(screen.getByText('Settings')).toHaveFocus()
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
    vi.mocked(require('next-auth/react').useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated'
    })

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.queryByText('Test User')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
  })

  it('should handle loading session state', () => {
    vi.mocked(require('next-auth/react').useSession).mockReturnValue({
      data: null,
      status: 'loading'
    })

    render(<MobileMenu {...defaultProps} isOpen={true} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should close menu on outside click', async () => {
    const onToggle = vi.fn()
    render(<MobileMenu {...defaultProps} isOpen={true} onToggle={onToggle} />)

    // Simulate clicking outside
    fireEvent.click(document.body)

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

  it('should apply custom className', () => {
    render(<MobileMenu {...defaultProps} className="custom-menu-class" />)

    const menu = screen.getByTestId('sheet')
    expect(menu).toHaveClass('custom-menu-class')
  })
})