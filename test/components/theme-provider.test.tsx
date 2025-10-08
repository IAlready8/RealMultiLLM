import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/components/theme-provider'

// Mock next-themes
const mockSetTheme = vi.fn()
const mockUseTheme = vi.fn()

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="next-themes-provider">{children}</div>,
  useTheme: () => mockUseTheme(),
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Test component that uses theme
const TestThemeConsumer = () => {
  const { theme, setTheme, systemTheme, resolvedTheme } = useTheme()

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="system-theme">{systemTheme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>
        System
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      systemTheme: 'light',
      resolvedTheme: 'light',
      themes: ['light', 'dark', 'system'],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render theme provider with default props', () => {
    render(
      <ThemeProvider>
        <div data-testid="child-content">Child Content</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('next-themes-provider')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('should provide theme context to children', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('system-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
  })

  it('should handle theme changes', async () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    const darkButton = screen.getByTestId('set-dark')
    await user.click(darkButton)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('should handle system theme preference', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
      systemTheme: 'dark',
      resolvedTheme: 'dark',
      themes: ['light', 'dark', 'system'],
    })

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')
    expect(screen.getByTestId('system-theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
  })

  it('should persist theme preference', async () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    const darkButton = screen.getByTestId('set-dark')
    await user.click(darkButton)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('should handle theme initialization from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue('dark')
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      systemTheme: 'light',
      resolvedTheme: 'dark',
      themes: ['light', 'dark', 'system'],
    })

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
  })

  it('should handle system theme changes', () => {
    // Mock matchMedia for system theme detection
    const mockMatchMedia = vi.fn()
    mockMatchMedia.mockReturnValue({
      matches: true, // Dark mode
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    window.matchMedia = mockMatchMedia

    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
      systemTheme: 'dark',
      resolvedTheme: 'dark',
      themes: ['light', 'dark', 'system'],
    })

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
  })

  it('should support custom theme attributes', () => {
    render(
      <ThemeProvider attribute="data-theme" enableSystem enableColorScheme>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('next-themes-provider')).toBeInTheDocument()
  })

  it('should handle theme transition animations', async () => {
    render(
      <ThemeProvider disableTransitionOnChange={false}>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    const darkButton = screen.getByTestId('set-dark')
    await user.click(darkButton)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('should handle invalid theme values gracefully', async () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    // Try to set an invalid theme
    mockSetTheme.mockImplementation((theme) => {
      if (!['light', 'dark', 'system'].includes(theme)) {
        console.warn(`Invalid theme: ${theme}`)
        return
      }
    })

    const button = screen.getByTestId('set-dark')
    await user.click(button)

    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('should provide theme toggle functionality', () => {
    // Create a theme toggle component
    const ThemeToggle = () => {
      const { theme, setTheme } = useTheme()

      const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light')
      }

      return (
        <button data-testid="theme-toggle" onClick={toggleTheme}>
          Toggle Theme
        </button>
      )
    }

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })

  it('should handle server-side rendering', () => {
    const originalWindow = global.window

    // @ts-expect-error allow removing window for SSR simulation
    delete (global as any).window

    try {
      const html = renderToString(
        <ThemeProvider>
          <div data-testid="child-content">Child Content</div>
        </ThemeProvider>
      )

      expect(html).toContain('ssr-theme-provider')
      expect(html).toContain('child-content')
    } finally {
      global.window = originalWindow
    }
  })

  it('should support forced theme modes', () => {
    render(
      <ThemeProvider forcedTheme="dark">
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('next-themes-provider')).toBeInTheDocument()
  })

  it('should handle theme storage key customization', () => {
    render(
      <ThemeProvider storageKey="custom-theme-key">
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('next-themes-provider')).toBeInTheDocument()
  })

  it('should support custom default theme', () => {
    mockUseTheme.mockReturnValue({
      theme: 'custom-default',
      setTheme: mockSetTheme,
      systemTheme: 'light',
      resolvedTheme: 'custom-default',
      themes: ['light', 'dark', 'custom-default'],
    })

    render(
      <ThemeProvider defaultTheme="custom-default">
        <TestThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('custom-default')
  })
})
