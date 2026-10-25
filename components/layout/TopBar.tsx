"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { Button } from "@/components/ui/button";
import { AlertsBell } from "@/components/layout/AlertsBell";
import { useAutoSync } from "@/lib/hooks/useBankSync";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Home", subtitle: "Your money at a glance" },
  "/transactions": { title: "Transactions", subtitle: "Every dollar, sorted" },
  "/insights": {
    title: "Insights",
    subtitle: "Trends and where it goes",
  },
  "/goals": { title: "Goals", subtitle: "Savings goals and challenges" },
  "/budgets": { title: "Budgets", subtitle: "This month's spending plan" },
  "/subscriptions": {
    title: "Subscriptions",
    subtitle: "Everything billing you on a schedule",
  },
  "/investments": {
    title: "Investments",
    subtitle: "Your portfolio, across every account",
  },
  "/credit-cards": {
    title: "Credit Cards",
    subtitle: "Balances, utilization, and payment timing",
  },
  "/net-worth": {
    title: "Net Worth",
    subtitle: "Assets minus liabilities over time",
  },
  "/chat": { title: "AI Advisor", subtitle: "Your financial copilot" },
  "/settings": { title: "Settings", subtitle: "Profile and preferences" },
};

export function TopBar() {
  const pathname = usePathname();
  const toggleSidebar = useFinanceStore((s) => s.toggleSidebar);
  // The top bar is on every page, so linked banks catch up wherever you land.
  useAutoSync();

  const meta = Object.entries(PAGE_META).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-transparent px-4 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      {meta && (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-semibold">{meta.title}</span>
          <span className="hidden truncate text-[12.5px] text-muted-foreground sm:inline">
            / {meta.subtitle}
          </span>
        </div>
      )}

      <div className="flex-1" />

      <Link
        href="/transactions?focus=search"
        className="hidden w-[180px] items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
        aria-label="Search transactions"
      >
        <Search className="size-[13px]" aria-hidden />
        Search
      </Link>
      <AlertsBell />
    </header>
  );
}
