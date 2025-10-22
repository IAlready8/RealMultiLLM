
"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
  returnUrl?: string;
  loadingComponent?: ReactNode;
  requiredRole?: string;
  unauthorizedRedirect?: string;
  checkExpiry?: boolean;
}

export function AuthGuard({
  children,
  redirectTo = '/auth/signin',
  returnUrl,
  loadingComponent,
  requiredRole,
  unauthorizedRedirect = '/unauthorized',
  checkExpiry = false
}: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  const isExpired = useMemo(() => {
    if (!checkExpiry || !session?.expires) return false;
    try {
      return new Date(session.expires) < new Date();
    } catch {
      return false;
    }
  }, [checkExpiry, session?.expires]);

  const hasRequiredRole = useMemo(() => {
    if (!requiredRole) return true;
    const role = (session as any)?.user?.role;
    return role === requiredRole;
  }, [requiredRole, session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (redirected) return;

    if (!session?.user || isExpired) {
      let target = redirectTo;
      if (returnUrl) {
        target = `${target}?callbackUrl=${encodeURIComponent(returnUrl)}`;
      }
      router.push(target);
      setRedirected(true);
      return;
    }

    if (!hasRequiredRole) {
      router.push(unauthorizedRedirect);
      setRedirected(true);
      return;
    }
  }, [session, status, router, redirectTo, returnUrl, unauthorizedRedirect, hasRequiredRole, isExpired, redirected]);

  if (status === 'loading') {
    return <>{loadingComponent ?? <div>Loading...</div>}</>;
  }

  if (!session?.user || isExpired || !hasRequiredRole) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
