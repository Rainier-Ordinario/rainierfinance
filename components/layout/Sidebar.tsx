"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeftRight,
  CreditCard,
  Home,
  LineChart,
  LogOut,
  MessageCircle,
  Moon,
  PiggyBank,
  Repeat,
  Settings,
  Sun,
  TrendingUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useSettings";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
  { href: "/net-worth", label: "Net Worth", icon: LineChart },
  { href: "/chat", label: "AI Advisor", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-foreground shadow-[inset_2px_0_0_var(--primary)]"
                : "font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-[17px] shrink-0",
                active ? "text-primary" : "text-muted-foreground/70"
              )}
              strokeWidth={1.7}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-5">
      <div className="flex size-[26px] items-center justify-center rounded-[7px] bg-primary">
        <span className="text-[13px] font-bold text-primary-foreground">
          R
        </span>
      </div>
      <span className="text-[14.5px] font-semibold tracking-tight">
        RainierFinance
      </span>
    </div>
  );
}

function UserFooter() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: profile } = useProfile();

  const name = profile?.full_name || "Account";
  const initials =
    profile?.full_name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-3 flex items-center gap-2 border-t border-sidebar-border px-2 pt-3 pb-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-sidebar-accent/60"
          aria-label="Account menu"
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {initials}
          </span>
          <span className="truncate text-[12.5px] font-semibold">{name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <User className="size-4" aria-hidden />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} variant="destructive">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Toggle dark mode"
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Sun className="size-[13px] dark:hidden" aria-hidden />
        <Moon className="hidden size-[13px] dark:block" aria-hidden />
      </button>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useFinanceStore((s) => s.sidebarOpen);
  const setSidebarOpen = useFinanceStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden h-svh w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <NavLinks />
        <div className="flex-1" />
        <UserFooter />
        <div className="pb-4" />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setSidebarOpen(false)} />
          <div className="flex-1" />
          <UserFooter />
          <div className="pb-4" />
        </SheetContent>
      </Sheet>
    </>
  );
}
