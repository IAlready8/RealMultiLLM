
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === "unauthenticated") {
      // Check if we're on an auth page by looking at window.location
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.startsWith("/auth")) {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`);
      }
    }
  }, [status, router]);
  
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  if (status === "authenticated" || currentPath.startsWith("/auth")) {
    return <>{children}</>;
  }
  
  return null;
}
