
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/mobile-menu";

export default function Navbar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: "Home", path: "/" },
    { name: "Multi-Chat", path: "/multi-chat" },
    { name: "Goal Hub", path: "/goal-hub" },
    { name: "Comparison", path: "/comparison" },
    { name: "Pipeline", path: "/pipeline" },
    { name: "Personas", path: "/personas" },
    { name: "Analytics", path: "/analytics" },
    { name: "Settings", path: "/settings" },
  ];

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
        <MobileMenu items={navItems} />
      </div>
    </nav>
  );
}
