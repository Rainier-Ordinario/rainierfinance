"use client";

import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  endOfMonth,
  format,
  parseISO,
  subMonths,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { toISODate } from "@/lib/utils/dates";
import {
  categoryTotalsInRange,
  spendOf,
  type CategoryTotal,
} from "@/lib/utils/aggregate";
import type { NetWorthSnapshot, Subscription, Transaction } from "@/types";

export interface BilledSubscription {
  subscription: Subscription;
  transaction: Transaction;
}

export interface PeriodRecap {
  start: string;
  end: string;
  label: string;
  spent: number;
  income: number;
  prevSpent: number;
  prevIncome: number;
  categories: CategoryTotal[];
  transactions: Transaction[];
  topTransactions: Transaction[];
  billedSubscriptions: BilledSubscription[];
  /** Null when no snapshot falls inside the period. */
  netWorthChange: {
    from: NetWorthSnapshot | null;
    to: NetWorthSnapshot;
    change: number | null;
  } | null;
}

function sumExpenses(txs: Transaction[]): number {
  return txs.reduce((s, t) => s + spendOf(t), 0);
}

function sumIncome(txs: Transaction[]): number {
  return txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchRecap(
  start: string,
  end: string,
  prevStart: string,
  label: string,
  topCount: number
): Promise<PeriodRecap> {
  const supabase = createClient();
  const [txRes, subRes, snapRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", prevStart)
      .lte("date", end)
      .order("date", { ascending: false }),
    supabase.from("subscriptions").select("*"),
    supabase
      .from("net_worth_snapshots")
      .select("*")
      .lte("snapshot_date", end)
      .order("snapshot_date", { ascending: false })
      .limit(12),
  ]);
  if (txRes.error) throw txRes.error;
  if (subRes.error) throw subRes.error;
  if (snapRes.error) throw snapRes.error;

  const allTx = (txRes.data ?? []) as Transaction[];
  const periodTx = allTx.filter((t) => t.date >= start);
  const prevTx = allTx.filter((t) => t.date < start);

  // Subscriptions billed this period: match expenses against subscription
  // names (normalized substring match).
  const subs = (subRes.data ?? []) as Subscription[];
  const billedSubscriptions: BilledSubscription[] = [];
  for (const sub of subs) {
    const name = normalize(sub.name);
    if (!name) continue;
    const match = periodTx.find(
      (t) => t.type === "expense" && normalize(t.description).includes(name)
    );
    if (match) billedSubscriptions.push({ subscription: sub, transaction: match });
  }

  // Net worth change: latest snapshot inside the period vs the latest one
  // before it started.
  const snapshots = (snapRes.data ?? []) as NetWorthSnapshot[];
  const inPeriod = snapshots.find(
    (s) => s.snapshot_date >= start && s.snapshot_date <= end
  );
  const before = snapshots.find((s) => s.snapshot_date < start);
  const netWorthChange = inPeriod
    ? {
        from: before ?? null,
        to: inPeriod,
        change: before
          ? Number(inPeriod.net_worth) - Number(before.net_worth)
          : null,
      }
    : null;

  const topTransactions = [...periodTx]
    .filter((t) => t.type !== "transfer")
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    .slice(0, topCount);

  return {
    start,
    end,
    label,
    spent: sumExpenses(periodTx),
    income: sumIncome(periodTx),
    prevSpent: sumExpenses(prevTx),
    prevIncome: sumIncome(prevTx),
    categories: categoryTotalsInRange(periodTx, start, end),
    transactions: periodTx,
    topTransactions,
    billedSubscriptions,
    netWorthChange,
  };
}

/**
 * Recap of a single week. `weekStart` is the ISO date of the week's first
 * day (Monday); the week covers weekStart..weekStart+6.
 */
export function useWeeklyRecap(weekStart: string) {
  return useQuery({
    queryKey: ["weekly_recap", weekStart],
    enabled: weekStart !== "",
    queryFn: () => {
      const start = parseISO(weekStart);
      return fetchRecap(
        weekStart,
        toISODate(addDays(start, 6)),
        toISODate(addDays(start, -7)),
        `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`,
        5
      );
    },
  });
}

/**
 * Recap of a calendar month. `monthStart` is the ISO date of the month's
 * first day.
 */
export function useMonthlyRecap(monthStart: string) {
  return useQuery({
    queryKey: ["monthly_recap", monthStart],
    enabled: monthStart !== "",
    queryFn: () => {
      const start = parseISO(monthStart);
      return fetchRecap(
        monthStart,
        toISODate(endOfMonth(start)),
        toISODate(subMonths(start, 1)),
        format(start, "MMMM yyyy"),
        8
      );
    },
  });
}
