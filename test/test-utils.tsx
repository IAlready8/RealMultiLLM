import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'

// Mock session data
const mockSession = {
  user: {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 2 * 86400).toISOString(),
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: any
  theme?: 'light' | 'dark' | 'system'
}

const AllTheProviders = ({ children, session, theme = 'dark' }: { 
  children: React.ReactNode
  session?: any
  theme?: 'light' | 'dark' | 'system'
}) => {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme={theme}
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}

const customRender = (
  ui: ReactElement,
  {
    session = mockSession,
    theme = 'dark',
    ...options
  }: CustomRenderOptions = {}
) =>
  render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders session={session} theme={theme}>
        {children}
      </AllTheProviders>
    ),
    ...options,
  })

export * from '@testing-library/react'
export { customRender as render }
export { mockSession }