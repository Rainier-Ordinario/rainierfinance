"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Bitcoin,
  CreditCard,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  PiggyBank,
  Repeat,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: Bitcoin },
  { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
  { href: "/net-worth", label: "Net Worth", icon: LineChart },
  { href: "/chat", label: "AI Advisor", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" aria-hidden />
      </div>
      <span className="text-base font-semibold tracking-tight">
        RainierFinance
      </span>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useFinanceStore((s) => s.sidebarOpen);
  const setSidebarOpen = useFinanceStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavLinks onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
