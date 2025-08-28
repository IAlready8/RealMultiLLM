
"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    if (status === "unauthenticated" && !pathname.startsWith("/auth")) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);
  
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center space-y-6 p-8">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
            <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-blue-500/20"></div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">MultiLLM Chat Assistant</h2>
            <p className="text-gray-400">Initializing secure connection...</p>
          </div>
          <div className="w-64 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (status === "authenticated" || pathname.startsWith("/auth")) {
    return <>{children}</>;
  }
  
  return null;
}
