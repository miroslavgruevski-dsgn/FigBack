"use client";

import { LogOut, Moon, Sun } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { data: session } = useSession();
  const { setTheme, resolvedTheme } = useTheme();

  const user = session?.user;

  const initials = (user?.name ?? user?.email ?? "U")
    .split(" ")
    .map((w) => w?.[0] ?? "")
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{user?.name ?? "Guest user"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email ?? "Not signed in"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
