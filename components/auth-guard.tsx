
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
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (status === "authenticated" || pathname.startsWith("/auth")) {
    return <>{children}</>;
  }
  
  return null;
}
