import {
  endOfMonth,
  format,
  getDate,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { categoryTotalsInRange, type CategoryTotal } from "@/lib/utils/aggregate";
import { toISODate } from "@/lib/utils/dates";
import type { Category, CategoryKind, Transaction } from "@/types";

/** The catch-all category the auto-categorizer falls back to. */
export const UNCATEGORIZED = "Other";

function magnitude(t: Transaction): number {
  return Math.abs(Number(t.amount));
}

function expensesIn(
  transactions: Transaction[],
  start: string,
  end: string
): Transaction[] {
  return transactions.filter(
    (t) => t.type === "expense" && t.date >= start && t.date <= end
  );
}

// ---------- Uncategorized spending ----------

export interface UncategorizedSummary {
  amount: number;
  count: number;
  /** Share of all spending in the window, 0–100. */
  share: number;
  start: string;
  end: string;
}

/** Spending stuck in the catch-all category over the last `days` days. */
export function uncategorizedSummary(
  transactions: Transaction[],
  days = 90,
  now = new Date()
): UncategorizedSummary {
  const start = toISODate(subDays(now, days));
  const end = toISODate(now);
  const expenses = expensesIn(transactions, start, end);
  const stuck = expenses.filter((t) => !t.category || t.category === UNCATEGORIZED);
  const total = expenses.reduce((sum, t) => sum + magnitude(t), 0);
  const amount = stuck.reduce((sum, t) => sum + magnitude(t), 0);
  return {
    amount,
    count: stuck.length,
    share: total > 0 ? (amount / total) * 100 : 0,
    start,
    end,
  };
}

// ---------- Fixed / essential / discretionary ----------

const DEFAULT_KINDS: Record<string, CategoryKind> = {
  Bills: "fixed",
  Subscriptions: "fixed",
  Streaming: "fixed",
  Education: "fixed",
  Rent: "fixed",
  Housing: "fixed",
  Mortgage: "fixed",
  Insurance: "fixed",
  Utilities: "fixed",
  Phone: "fixed",
  Internet: "fixed",
  Groceries: "essential",
  Gas: "essential",
  Transit: "essential",
  Health: "essential",
  Pharmacy: "essential",
  Parking: "essential",
};

export const KIND_LABELS: Record<CategoryKind, string> = {
  fixed: "Fixed",
  essential: "Essentials",
  discretionary: "Discretionary",
};

export const KIND_DESCRIPTIONS: Record<CategoryKind, string> = {
  fixed: "Bills and subscriptions that cost the same each month",
  essential: "Needs whose amount varies, like groceries and transit",
  discretionary: "Wants: dining, delivery, shopping, entertainment",
};

/** The user's choice for a category, else a sensible default by name. */
export function categoryKind(
  name: string,
  categories: Category[]
): CategoryKind {
  const chosen = categories.find((c) => c.name === name)?.kind;
  return chosen ?? DEFAULT_KINDS[name] ?? "discretionary";
}

export type KindTotals = Record<CategoryKind, number>;

export function kindTotals(
  transactions: Transaction[],
  categories: Category[],
  start: string,
  end: string
): KindTotals {
  const totals: KindTotals = { fixed: 0, essential: 0, discretionary: 0 };
  for (const t of expensesIn(transactions, start, end)) {
    totals[categoryKind(t.category, categories)] += magnitude(t);
  }
  return totals;
}

export interface SpendingMix {
  /** Month to date. */
  current: KindTotals;
  /** Last month up to the same day of the month. */
  lastMonthSamePoint: KindTotals;
  /** Average full month over the previous three months. */
  monthlyAverage: KindTotals;
}

/**
 * This month's split by kind, with two comparisons: last month at the same
 * point (a fair pace check mid-month) and the 3-month average (what a normal
 * whole month costs).
 */
export function spendingMix(
  transactions: Transaction[],
  categories: Category[],
  now = new Date()
): SpendingMix {
  const day = getDate(now);
  const lastMonth = subMonths(now, 1);
  // Day 31 in a 30-day month compares against the whole of last month.
  const lastMonthEnd = Math.min(day, getDate(endOfMonth(lastMonth)));

  const avgStart = toISODate(startOfMonth(subMonths(now, 3)));
  const avgEnd = toISODate(endOfMonth(lastMonth));
  const threeMonths = kindTotals(transactions, categories, avgStart, avgEnd);

  return {
    current: kindTotals(
      transactions,
      categories,
      toISODate(startOfMonth(now)),
      toISODate(now)
    ),
    lastMonthSamePoint: kindTotals(
      transactions,
      categories,
      toISODate(startOfMonth(lastMonth)),
      toISODate(new Date(lastMonth.getFullYear(), lastMonth.getMonth(), lastMonthEnd))
    ),
    monthlyAverage: {
      fixed: threeMonths.fixed / 3,
      essential: threeMonths.essential / 3,
      discretionary: threeMonths.discretionary / 3,
    },
  };
}

// ---------- Category breakdown by period ----------

export type SpendingPeriod = "this_month" | "last_month" | "3_months" | "12_months";

export const PERIOD_LABELS: Record<SpendingPeriod, string> = {
  this_month: "This month",
  last_month: "Last month",
  "3_months": "3 months",
  "12_months": "12 months",
};

export interface CategoryBreakdownRow extends CategoryTotal {
  /** Average spend per month within the period. */
  perMonth: number;
  /** Average full month for this category in the 3 months before the period. */
  baseline: number;
}

export interface CategoryBreakdown {
  start: string;
  end: string;
  /** Human range, e.g. "Jul – Sep 2026". */
  label: string;
  months: number;
  rows: CategoryBreakdownRow[];
}

/**
 * Where the money went over a period, with each category's usual monthly
 * spend from the three months just before it. Multi-month periods cover
 * whole completed months so averages aren't dragged down by a partial one.
 */
export function categoryBreakdown(
  transactions: Transaction[],
  period: SpendingPeriod,
  now = new Date()
): CategoryBreakdown {
  let from: Date;
  let to: Date;
  let months: number;
  switch (period) {
    case "last_month":
      from = startOfMonth(subMonths(now, 1));
      to = endOfMonth(from);
      months = 1;
      break;
    case "3_months":
      from = startOfMonth(subMonths(now, 3));
      to = endOfMonth(subMonths(now, 1));
      months = 3;
      break;
    case "12_months":
      from = startOfMonth(subMonths(now, 12));
      to = endOfMonth(subMonths(now, 1));
      months = 12;
      break;
    default:
      from = startOfMonth(now);
      to = now;
      months = 1;
  }

  const start = toISODate(from);
  const end = toISODate(to);
  const baselineTotals = categoryTotalsInRange(
    transactions,
    toISODate(subMonths(from, 3)),
    toISODate(subDays(from, 1))
  );
  const baselineOf = (category: string) =>
    (baselineTotals.find((b) => b.category === category)?.amount ?? 0) / 3;

  const label =
    months === 1
      ? format(from, "MMMM yyyy")
      : `${format(from, "MMM yyyy")} – ${format(to, "MMM yyyy")}`;

  return {
    start,
    end,
    label,
    months,
    rows: categoryTotalsInRange(transactions, start, end).map((row) => ({
      ...row,
      perMonth: row.amount / months,
      baseline: baselineOf(row.category),
    })),
  };
}
