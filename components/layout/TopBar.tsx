"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Menu, Moon, Sun, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useSettings";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toggleSidebar = useFinanceStore((s) => s.toggleSidebar);
  const { data: profile } = useProfile();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle dark mode"
      >
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="hidden size-4 dark:block" aria-hidden />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="gap-2 px-2"
            aria-label="Account menu"
          >
            <Avatar className="size-7">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt="" />
              )}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {profile?.full_name ?? "Account"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <User className="size-4" aria-hidden />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} variant="destructive">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
