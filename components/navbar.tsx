
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/mobile-menu";

export default function Navbar() {
  const pathname = usePathname();
  
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Multi-Chat", href: "/multi-chat" },
    { label: "Goal Hub", href: "/goal-hub" },
    { label: "Comparison", href: "/comparison" },
    { label: "Pipeline", href: "/pipeline" },
    { label: "Personas", href: "/personas" },
    { label: "Analytics", href: "/analytics" },
    { label: "Settings", href: "/settings" },
  ];

  return (
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          MultiLLM
        </Link>
        <div className="hidden space-x-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-4 py-2 rounded-lg transition-all smooth-transition ${
                pathname === item.href
                  ? "text-foreground font-medium bg-card border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <MobileMenu navigationItems={navItems.map(item => ({ href: item.href, label: item.label }))} />
      </div>
    </nav>
  );
}
