
import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { AuthGuard } from "@/components/auth-guard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MultiLLM Chat Assistant",
  description: "A tool for interacting with multiple LLM APIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-950 text-white`}>
        <AuthProvider>
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
              </div>
            </AuthGuard>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
