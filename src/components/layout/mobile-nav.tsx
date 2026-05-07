"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/security", label: "Security" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [showSetupLink, setShowSetupLink] = useState(false);
  const pathname = usePathname();
  const allLinks = showSetupLink
    ? [{ href: "/setup", label: "Setup" }, ...links]
    : links;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/setup/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ready?: boolean };
        if (mounted) setShowSetupLink(!data.ready);
      } catch {
        // Ignore nav-level setup fetch failures.
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden size-9" aria-label="Open menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">FigBack</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {allLinks.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
                  active ? "bg-accent text-foreground" : "text-foreground/80"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
