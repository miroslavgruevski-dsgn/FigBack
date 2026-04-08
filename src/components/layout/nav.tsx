"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/security", label: "Security" },
];

const hiddenRoutes = ["/auth", "/onboarding"];

export function Nav() {
  const pathname = usePathname();

  if (hiddenRoutes.some((r) => pathname.startsWith(r))) return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <MobileNav />

        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <MessageSquare className="size-5 text-primary" />
          <span>FigBack</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground",
                "after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:rounded-full after:bg-primary after:transition-all after:duration-200",
                isActive(link.href)
                  ? "text-foreground after:w-4"
                  : "text-muted-foreground after:w-0"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
