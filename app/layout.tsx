
import './globals.css';
import { AuthGuard } from '@/components/auth-guard';
import { AuthProvider } from '@/components/auth-provider';
import ConsentBanner from '@/components/consent-banner';
import Navbar from '@/components/navbar';
import { SettingsProvider } from '@/components/settings-provider';
import { ThemeProvider } from '@/components/theme-provider';

import type { Metadata } from 'next';

const inter = { className: 'font-sans' };

export const metadata: Metadata = {
  title: "MultiLLM Chat Assistant",
  description: "A professional tool for interacting with multiple LLM APIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <AuthGuard>
                <div className="min-h-screen flex flex-col">
                  <Navbar />
                  <main className="flex-1">
                    {children}
                  </main>
                  <ConsentBanner />
                </div>
              </AuthGuard>
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
