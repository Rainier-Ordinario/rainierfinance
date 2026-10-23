"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBudgets } from "@/lib/hooks/useBudgets";
import { useCategories } from "@/lib/hooks/useCategories";
import { useChallenges } from "@/lib/hooks/useGoals";
import { useMerchantRules } from "@/lib/hooks/useMerchantRules";
import { useUserSettings } from "@/lib/hooks/useSettings";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { buildAlerts, type AlertSeverity } from "@/lib/utils/alerts";
import { DEFAULT_SAVINGS_TARGET_PCT } from "@/lib/utils/spending";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "alerts-dismissed";

const DOT: Record<AlertSeverity, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  info: "bg-muted-foreground",
};

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** Top-bar bell: the nudges that turn tracking into habits. */
export function AlertsBell() {
  const transactions = useTransactions();
  const categories = useCategories();
  const budgets = useBudgets();
  const subscriptions = useSubscriptions();
  const challenges = useChallenges();
  const settings = useUserSettings();
  const rules = useMerchantRules();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [open, setOpen] = useState(false);

  const alerts = useMemo(
    () =>
      transactions.data
        ? buildAlerts({
            transactions: transactions.data,
            categories: categories.data ?? [],
            budgets: budgets.data ?? [],
            subscriptions: subscriptions.data ?? [],
            // Missing until migration 007; challenges just don't alert.
            challenges: challenges.data ?? [],
            rules,
            savingsTargetPct: Number(
              settings.data?.savings_target_pct ?? DEFAULT_SAVINGS_TARGET_PCT
            ),
          }).filter((a) => !dismissed.has(a.id))
        : [],
    [
      transactions.data,
      categories.data,
      budgets.data,
      subscriptions.data,
      challenges.data,
      settings.data,
      rules,
      dismissed,
    ]
  );

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next].slice(-200)));
    } catch {
      // Private mode: dismissal lasts this session only.
    }
    setDismissed(next);
  }

  const urgent = alerts.some((a) => a.severity === "high");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={alerts.length ? `${alerts.length} alerts` : "Alerts"}
        >
          <Bell className="size-[18px]" aria-hidden />
          {alerts.length > 0 && (
            <span
              className={cn(
                "absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                urgent ? "bg-destructive" : "bg-chart-1"
              )}
              aria-hidden
            >
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Alerts</p>
        {alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            All clear. Nothing needs your attention.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-2 px-4 py-3">
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[a.severity])}
                  aria-hidden
                />
                <Link
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="min-w-0 flex-1 text-sm hover:underline"
                >
                  <span className="block font-medium">{a.title}</span>
                  {a.detail && (
                    <span className="block text-xs text-muted-foreground">
                      {a.detail}
                    </span>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground"
                  onClick={() => dismiss(a.id)}
                  aria-label={`Dismiss: ${a.title}`}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
