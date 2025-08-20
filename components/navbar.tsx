"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from '@/hooks/command-palette-context';
import { Search } from "lucide-react";
import { UserNav } from "./user-nav";

export default function Navbar() {
  const pathname = usePathname();
  const { setIsOpen } = useCommandPalette();

  const baseNavItems = [
    { name: "Home", path: "/" },
    { name: "Multi-Chat", path: "/multi-chat" },
    { name: "Goal Hub", path: "/goal-hub" },
    { name: "Comparison", path: "/comparison" },
    { name: "Pipeline", path: "/pipeline" },
    { name: "Personas", path: "/personas" },
    { name: "Analytics", path: "/analytics" },
    { name: "Settings", path: "/settings" },
  ];

  // Add deployment status in development mode
  const navItems = process.env.NODE_ENV === 'development' 
    ? [...baseNavItems, { name: "Deploy Status", path: "/deploy-status" }]
    : baseNavItems;

  return (
    <nav className="border-b border-gray-800">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold">
          MultiLLM
        </Link>
        <div className="hidden space-x-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`transition-colors ${
                pathname === item.path
                  ? "text-blue-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                className="h-9 w-full justify-start px-3 text-sm text-muted-foreground hidden md:flex"
            >
                <Search className="h-4 w-4 mr-2" />
                Search...
                <kbd className="pointer-events-none ml-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
            <UserNav />
            <MobileMenu items={navItems} />
        </div>
      </div>
    </nav>
  );
}