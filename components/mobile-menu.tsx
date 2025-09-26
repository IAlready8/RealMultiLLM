
"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, MessageSquare, Settings, LogOut, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  MessageSquare,
  Settings,
  LogOut,
  User,
};

interface NavigationItem {
  href: string;
  label: string;
  icon?: keyof typeof ICON_MAP | ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface MobileMenuProps {
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  navigationItems?: NavigationItem[];
  footerItems?: NavigationItem[];
  trigger?: ReactNode;
  className?: string;
  signOutCallbackUrl?: string;
  showUserSection?: boolean;
}

const DEFAULT_ITEMS: NavigationItem[] = [
  { href: '/', label: 'Home', icon: 'Home' },
  { href: '/chat', label: 'Chat', icon: 'MessageSquare' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
];

function resolveIcon(icon?: NavigationItem['icon']) {
  if (!icon) return null;
  if (typeof icon === 'function') return icon;
  return ICON_MAP[icon] ?? null;
}

export function MobileMenu({
  isOpen,
  onToggle,
  navigationItems = DEFAULT_ITEMS,
  footerItems,
  trigger,
  className,
  signOutCallbackUrl = '/',
  showUserSection = true
}: MobileMenuProps) {
  const controlled = typeof isOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState<boolean>(isOpen ?? false);
  const open = controlled ? (isOpen as boolean) : internalOpen;

  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (controlled) return;
    setInternalOpen(isOpen ?? false);
  }, [isOpen, controlled]);

  const handleOpenChange = (next: boolean) => {
    if (!controlled) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (contentRef.current && target && !contentRef.current.contains(target)) {
        handleOpenChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const items = useMemo(() => navigationItems ?? DEFAULT_ITEMS, [navigationItems]);

  const renderNavItem = (item: NavigationItem) => {
    const IconComponent = resolveIcon(item.icon);
    const isActive = pathname === item.href;
    const classNames = [
      'flex w-full items-center gap-3 rounded-md px-4 py-2 text-sm transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    ].join(' ');

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (item.onClick) {
        item.onClick();
      } else {
        router.push(item.href);
      }
      handleOpenChange(false);
    };

    const Content = (
      <a className={classNames} onClick={handleClick} data-nav-item>
        {IconComponent ? <IconComponent className="h-4 w-4" /> : null}
        <span>{item.label}</span>
      </a>
    );

    return (
      <Link key={item.href} href={item.href} legacyBehavior>
        {Content}
      </Link>
    );
  };

  const handleSignOut = async () => {
    handleOpenChange(false);
    const mod = await import('next-auth/react');
    await mod.signOut({ callbackUrl: signOutCallbackUrl });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className={`bg-background/95 backdrop-blur-sm sm:w-[300px] ${className ?? ''}`}>
        <div ref={contentRef} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">Menu</SheetTitle>
          </SheetHeader>

          {status === 'loading' ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            <>
              {showUserSection && session?.user && (
                <div className="mt-6 space-y-1 border-b border-border pb-4">
                  <p className="text-sm font-medium">{session.user.name ?? 'User'}</p>
                  {session.user.email && (
                    <p className="text-xs text-muted-foreground">{session.user.email}</p>
                  )}
                </div>
              )}

              <nav className="mt-4 flex flex-col gap-2">
                {items.map(renderNavItem)}
              </nav>

              {footerItems && footerItems.length > 0 && (
                <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                  {footerItems.map(renderNavItem)}
                </div>
              )}

              {showUserSection && session?.user && (
                <div className="mt-4 border-t border-border pt-4">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileMenu;
