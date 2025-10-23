import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { ThemeProvider } from 'next-themes';

interface ProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

const AllTheProviders = ({ children, session }: ProviderProps) => (
  <SessionProvider session={session}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  </SessionProvider>
);

type ExtendedRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  session?: Session | null;
};

const customRender = (
  ui: ReactElement,
  { session = null, ...options }: ExtendedRenderOptions = {},
) =>
  render(ui, {
    wrapper: (props) => <AllTheProviders session={session} {...props} />,
    ...options,
  });

export * from '@testing-library/react';
export { customRender as render };
