
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

const ensureWindowStub = () => {
  const globalObj = globalThis as any;
  if (!globalObj.window) {
    globalObj.window = {
      navigator: {
        clipboard: {
          writeText: () => Promise.resolve(),
          readText: () => Promise.resolve(''),
        },
        userAgent: '',
      },
      matchMedia: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    };
  }
};

const SSRThemeContainer = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="ssr-theme-provider">{children}</div>
)

if (typeof window === 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test') {
  ensureWindowStub();
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  if (typeof window === 'undefined') {
    ensureWindowStub();
    return <SSRThemeContainer>{children}</SSRThemeContainer>
  }
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export const useTheme = () => {
  const themeContext = useNextTheme()

  if (typeof window === 'undefined') {
    ensureWindowStub()
    return {
      theme: undefined,
      setTheme: () => undefined,
      systemTheme: undefined,
      resolvedTheme: undefined,
      themes: [] as string[],
    }
  }

  return themeContext
}

export default ThemeProvider
