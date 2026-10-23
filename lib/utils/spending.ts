import {
  endOfMonth,
  format,
  getDate,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { categoryTotalsInRange, type CategoryTotal } from "@/lib/utils/aggregate";
import { merchantKey } from "@/lib/utils/categorize";
import { toISODate } from "@/lib/utils/dates";
import type { Category, CategoryKind, Transaction } from "@/types";

/** Money-movement categories that aren't really spending. */
export const NOT_SPENDING = new Set(["Income", "Transfer", "Investments", "Crypto"]);

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
 * Date window for a period. Multi-month periods cover whole completed months
 * so averages aren't dragged down by a partial one.
 */
export function periodRange(period: SpendingPeriod, now = new Date()) {
  switch (period) {
    case "last_month": {
      const from = startOfMonth(subMonths(now, 1));
      return { from, to: endOfMonth(from), months: 1 };
    }
    case "3_months":
      return {
        from: startOfMonth(subMonths(now, 3)),
        to: endOfMonth(subMonths(now, 1)),
        months: 3,
      };
    case "12_months":
      return {
        from: startOfMonth(subMonths(now, 12)),
        to: endOfMonth(subMonths(now, 1)),
        months: 12,
      };
    default:
      return { from: startOfMonth(now), to: now, months: 1 };
  }
}

/** Human label for a period window, e.g. "September 2026". */
export function periodLabel(from: Date, to: Date, months: number): string {
  return months === 1
    ? format(from, "MMMM yyyy")
    : `${format(from, "MMM yyyy")} – ${format(to, "MMM yyyy")}`;
}

/**
 * Where the money went over a period, with each category's usual monthly
 * spend from the three months just before it.
 */
export function categoryBreakdown(
  transactions: Transaction[],
  period: SpendingPeriod,
  now = new Date()
): CategoryBreakdown {
  const { from, to, months } = periodRange(period, now);
  const start = toISODate(from);
  const end = toISODate(to);
  const baselineTotals = categoryTotalsInRange(
    transactions,
    toISODate(subMonths(from, 3)),
    toISODate(subDays(from, 1))
  );
  const baselineOf = (category: string) =>
    (baselineTotals.find((b) => b.category === category)?.amount ?? 0) / 3;

  return {
    start,
    end,
    label: periodLabel(from, to, months),
    months,
    rows: categoryTotalsInRange(transactions, start, end).map((row) => ({
      ...row,
      perMonth: row.amount / months,
      baseline: baselineOf(row.category),
    })),
  };
}

// ---------- Category trends ----------

export interface TrendMonth {
  /** Short month, e.g. "Sep". */
  label: string;
  start: string;
  end: string;
  amount: number;
  /** The current, still-running month. */
  partial: boolean;
}

export interface CategoryTrend {
  category: string;
  months: TrendMonth[];
  /** Total across all complete months shown. */
  total: number;
  /** Average of the last 3 complete months. */
  recentAvg: number;
  /** Average of the 3 complete months before those. */
  priorAvg: number;
  /** recentAvg vs priorAvg as a fraction (0.25 = +25%); null without prior spend. */
  change: number | null;
}

/**
 * Each expense category's monthly spend over the last `months` months
 * (current month last, flagged partial), with a recent-vs-prior 3-month
 * trend so slow creep shows up even when no single month looks unusual.
 */
export function categoryTrends(
  transactions: Transaction[],
  months = 12,
  now = new Date()
): CategoryTrend[] {
  const windows = monthWindows(months, now);

  const byCategory = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const idx = windows.findIndex((w) => t.date >= w.start && t.date <= w.end);
    if (idx === -1) continue;
    const amounts = byCategory.get(t.category) ?? new Array(months).fill(0);
    amounts[idx] += magnitude(t);
    byCategory.set(t.category, amounts);
  }

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

  return [...byCategory.entries()]
    .map(([category, amounts]) => {
      const complete = amounts.slice(0, -1);
      const recentAvg = avg(complete.slice(-3));
      const priorAvg = avg(complete.slice(-6, -3));
      return {
        category,
        months: windows.map((w, i) => ({ ...w, amount: amounts[i] })),
        total: complete.reduce((s, x) => s + x, 0),
        recentAvg,
        priorAvg,
        change: priorAvg > 0 ? recentAvg / priorAvg - 1 : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ---------- Top merchants ----------

export interface MerchantSummary {
  key: string;
  /** Readable name derived from the normalized key. */
  name: string;
  /** The category most of this merchant's charges fall in. */
  category: string;
  visits: number;
  total: number;
  average: number;
  lastDate: string;
  /** A word to search transactions with to find this merchant. */
  searchTerm: string;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Where spending concentrates by merchant in a date range, biggest first. */
export function topMerchants(
  transactions: Transaction[],
  start: string,
  end: string
): MerchantSummary[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of expensesIn(transactions, start, end)) {
    const key = merchantKey(t.description);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return [...groups.entries()]
    .map(([key, txs]) => {
      const total = txs.reduce((s, t) => s + magnitude(t), 0);
      const categoryCounts = new Map<string, number>();
      for (const t of txs) {
        categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
      }
      const category = [...categoryCounts.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0][0];
      return {
        key,
        name: titleCase(key),
        category,
        visits: txs.length,
        total,
        average: total / txs.length,
        lastDate: txs.reduce((d, t) => (t.date > d ? t.date : d), ""),
        searchTerm: key.split(" ").sort((a, b) => b.length - a.length)[0],
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ---------- Safe to spend ----------

export const DEFAULT_SAVINGS_TARGET_PCT = 20;

export interface SafeToSpend {
  /** This month's income: received so far or the 3-month average, whichever is more. */
  expectedIncome: number;
  /** Fixed and essential costs expected this month (so far or usual, whichever is more). */
  expectedFixed: number;
  expectedEssential: number;
  savingsTarget: number;
  /** What's left for discretionary spending this whole month. */
  wantsBudget: number;
  spentBeforeToday: number;
  spentToday: number;
  /** Days left in the month, today included. */
  daysLeft: number;
  /** What can go to wants each remaining day, today included. */
  dailyAllowance: number;
  /** wantsBudget minus all discretionary spending so far (negative = over). */
  remaining: number;
}

/**
 * How much can go to wants today while still hitting the savings goal:
 * expected income, minus what bills and essentials will cost this month,
 * minus the savings target, minus wants already bought, spread over the
 * days left. "Expected" takes the larger of so-far and usual, so a rent
 * payment that hasn't landed yet is still reserved for.
 */
export function safeToSpend(
  transactions: Transaction[],
  categories: Category[],
  savingsTargetPct: number,
  now = new Date()
): SafeToSpend | null {
  const monthStart = toISODate(startOfMonth(now));
  const today = toISODate(now);
  const avgStart = toISODate(startOfMonth(subMonths(now, 3)));
  const avgEnd = toISODate(endOfMonth(subMonths(now, 1)));

  const incomeIn = (start: string, end: string) =>
    transactions
      .filter((t) => t.type === "income" && t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const expectedIncome = Math.max(
    incomeIn(monthStart, today),
    incomeIn(avgStart, avgEnd) / 3
  );
  if (expectedIncome <= 0) return null;

  const soFar = kindTotals(transactions, categories, monthStart, today);
  const usual = kindTotals(transactions, categories, avgStart, avgEnd);
  const expectedFixed = Math.max(soFar.fixed, usual.fixed / 3);
  const expectedEssential = Math.max(soFar.essential, usual.essential / 3);
  const savingsTarget = (expectedIncome * savingsTargetPct) / 100;
  const wantsBudget =
    expectedIncome - expectedFixed - expectedEssential - savingsTarget;

  const spentToday = kindTotals(transactions, categories, today, today).discretionary;
  const spentBeforeToday = soFar.discretionary - spentToday;
  const daysLeft = getDate(endOfMonth(now)) - getDate(now) + 1;
  const remaining = wantsBudget - soFar.discretionary;

  return {
    expectedIncome,
    expectedFixed,
    expectedEssential,
    savingsTarget,
    wantsBudget,
    spentBeforeToday,
    spentToday,
    daysLeft,
    dailyAllowance: Math.max(0, (wantsBudget - spentBeforeToday) / daysLeft),
    remaining,
  };
}

// ---------- What changed ----------

export interface MerchantChange {
  name: string;
  amount: number;
  usual: number;
  diff: number;
}

export interface CategoryChange {
  category: string;
  amount: number;
  /** Average per period over the comparison periods. */
  usual: number;
  diff: number;
  /** usual > 0 → diff / usual; null for a category with no usual spend. */
  pct: number | null;
  /** Merchants that moved most in the same direction, biggest first. */
  merchants: MerchantChange[];
}

export interface WhatChanged {
  up: CategoryChange[];
  down: CategoryChange[];
  /** Total spending in the period minus the usual total. */
  totalDiff: number;
  usualTotal: number;
}

/** A change has to clear both of these to be worth calling out. */
const MIN_CHANGE_DOLLARS = 20;
const MIN_CHANGE_PCT = 0.1;

function isNotable(diff: number, usual: number): boolean {
  return (
    Math.abs(diff) >= MIN_CHANGE_DOLLARS &&
    Math.abs(diff) >= usual * MIN_CHANGE_PCT
  );
}

/**
 * Which categories (and the merchants inside them) moved most in a period
 * against their average over `baselines` — equal-length periods just before
 * it. For a period still in progress, pass `partial` and only increases are
 * reported: being under usual mid-month usually just means it isn't over.
 */
export function whatChanged(
  transactions: Transaction[],
  period: { start: string; end: string },
  baselines: { start: string; end: string }[],
  { partial = false, limit = 3, merchantLimit = 2 } = {}
): WhatChanged {
  const inPeriod = expensesIn(transactions, period.start, period.end);
  const inBaselines = baselines.flatMap((b) =>
    expensesIn(transactions, b.start, b.end)
  );
  const n = Math.max(1, baselines.length);

  const sumBy = (txs: Transaction[], keyOf: (t: Transaction) => string) => {
    const totals = new Map<string, number>();
    for (const t of txs) {
      const key = keyOf(t);
      totals.set(key, (totals.get(key) ?? 0) + magnitude(t));
    }
    return totals;
  };

  const current = sumBy(inPeriod, (t) => t.category);
  const usual = sumBy(inBaselines, (t) => t.category);
  const categories = new Set([...current.keys(), ...usual.keys()]);

  const changes: CategoryChange[] = [];
  for (const category of categories) {
    const amount = current.get(category) ?? 0;
    const avg = (usual.get(category) ?? 0) / n;
    const diff = amount - avg;
    if (!isNotable(diff, avg) || (partial && diff < 0)) continue;

    const nowByMerchant = sumBy(
      inPeriod.filter((t) => t.category === category),
      (t) => merchantKey(t.description)
    );
    const usualByMerchant = sumBy(
      inBaselines.filter((t) => t.category === category),
      (t) => merchantKey(t.description)
    );
    const merchants = [
      ...new Set([...nowByMerchant.keys(), ...usualByMerchant.keys()]),
    ]
      .filter(Boolean)
      .map((key) => {
        const m = nowByMerchant.get(key) ?? 0;
        const u = (usualByMerchant.get(key) ?? 0) / n;
        return { name: titleCase(key), amount: m, usual: u, diff: m - u };
      })
      // Same direction as the category, and big enough to explain part of it.
      .filter((m) => Math.sign(m.diff) === Math.sign(diff) && Math.abs(m.diff) >= 5)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, merchantLimit);

    changes.push({
      category,
      amount,
      usual: avg,
      diff,
      pct: avg > 0 ? diff / avg : null,
      merchants,
    });
  }

  const totalNow = [...current.values()].reduce((s, x) => s + x, 0);
  const usualTotal = [...usual.values()].reduce((s, x) => s + x, 0) / n;

  return {
    up: changes
      .filter((c) => c.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, limit),
    down: changes
      .filter((c) => c.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, limit),
    totalDiff: totalNow - usualTotal,
    usualTotal,
  };
}

// ---------- Habits ----------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface WeekdayPattern {
  days: { day: string; average: number }[];
  /** Average discretionary spend on a Saturday or Sunday. */
  weekendAverage: number;
  /** Average discretionary spend on a Monday–Friday. */
  weekdayAverage: number;
  weeks: number;
}

/**
 * Average discretionary spend per weekday over the last `weeks` complete
 * Monday–Sunday weeks: the shape of when wants get bought.
 */
export function weekdayPattern(
  transactions: Transaction[],
  categories: Category[],
  weeks = 12,
  now = new Date()
): WeekdayPattern {
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
  const start = toISODate(subWeeks(thisMonday, weeks));
  const end = toISODate(subDays(thisMonday, 1));
  const totals = new Array(7).fill(0);
  for (const t of expensesIn(transactions, start, end)) {
    if (categoryKind(t.category, categories) !== "discretionary") continue;
    // getDay: Sunday = 0; shift so Monday = 0.
    totals[(parseISO(t.date).getDay() + 6) % 7] += magnitude(t);
  }
  const days = WEEKDAYS.map((day, i) => ({ day, average: totals[i] / weeks }));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  return {
    days,
    weekendAverage: sum(totals.slice(5)) / (2 * weeks),
    weekdayAverage: sum(totals.slice(0, 5)) / (5 * weeks),
    weeks,
  };
}

export interface MonthlyCount {
  label: string;
  start: string;
  partial: boolean;
  count: number;
  total: number;
}

/** The last `months` months (current month last, flagged partial). */
function monthWindows(months: number, now: Date) {
  return Array.from({ length: months }, (_, i) => {
    const d = subMonths(now, months - 1 - i);
    return {
      label: format(d, "MMM"),
      start: toISODate(startOfMonth(d)),
      end: toISODate(endOfMonth(d)),
      partial: i === months - 1,
    };
  });
}

export const SMALL_PURCHASE_LIMIT = 15;

/**
 * Non-bill purchases under `limit` each month: individually forgettable,
 * together often a real line item.
 */
export function smallPurchases(
  transactions: Transaction[],
  categories: Category[],
  months = 6,
  limit = SMALL_PURCHASE_LIMIT,
  now = new Date()
): MonthlyCount[] {
  return monthWindows(months, now).map((w) => {
    const small = expensesIn(transactions, w.start, w.end).filter(
      (t) =>
        magnitude(t) < limit && categoryKind(t.category, categories) !== "fixed"
    );
    return {
      label: w.label,
      start: w.start,
      partial: w.partial,
      count: small.length,
      total: small.reduce((s, t) => s + magnitude(t), 0),
    };
  });
}

export interface FoodMonth {
  label: string;
  partial: boolean;
  groceries: number;
  dining: number;
  delivery: number;
  /** Delivery as a share of all food spending, 0–100; null with no food spend. */
  deliveryShare: number | null;
}

/** How food money splits between groceries, eating out, and delivery. */
export function foodSplit(
  transactions: Transaction[],
  months = 6,
  now = new Date()
): FoodMonth[] {
  return monthWindows(months, now).map((w) => {
    const txs = expensesIn(transactions, w.start, w.end);
    const sumOf = (category: string) =>
      txs
        .filter((t) => t.category === category)
        .reduce((s, t) => s + magnitude(t), 0);
    const groceries = sumOf("Groceries");
    const dining = sumOf("Dining");
    const delivery = sumOf("Food Delivery");
    const food = groceries + dining + delivery;
    return {
      label: w.label,
      partial: w.partial,
      groceries,
      dining,
      delivery,
      deliveryShare: food > 0 ? (delivery / food) * 100 : null,
    };
  });
}

// ---------- Savings and money flow ----------

export interface SavingsMonth {
  label: string;
  start: string;
  partial: boolean;
  income: number;
  spent: number;
  saved: number;
  /** Share of income not spent, as a percent; null without income. */
  rate: number | null;
}

/** Income kept each month: (income − spending) ÷ income. */
export function savingsRateTrend(
  transactions: Transaction[],
  months = 12,
  now = new Date()
): SavingsMonth[] {
  return monthWindows(months, now).map((w) => {
    let income = 0;
    let spent = 0;
    for (const t of transactions) {
      if (t.date < w.start || t.date > w.end) continue;
      if (t.type === "income") income += magnitude(t);
      else if (t.type === "expense") spent += magnitude(t);
    }
    return {
      label: w.label,
      start: w.start,
      partial: w.partial,
      income,
      spent,
      saved: income - spent,
      rate: income > 0 ? ((income - spent) / income) * 100 : null,
    };
  });
}

export interface FlowGroup {
  kind: CategoryKind;
  total: number;
  /** Biggest categories first, the rest folded into one entry. */
  categories: { name: string; amount: number }[];
}

export interface MoneyFlow {
  income: number;
  spent: number;
  /** income − spent; negative means savings were drawn down. */
  saved: number;
  groups: FlowGroup[];
}

/**
 * Where income went in a date range: into fixed bills, essentials, and
 * discretionary spending (each broken into its top categories), with the
 * remainder saved.
 */
export function moneyFlow(
  transactions: Transaction[],
  categories: Category[],
  start: string,
  end: string,
  perGroup = 4
): MoneyFlow {
  let income = 0;
  for (const t of transactions) {
    if (t.type === "income" && t.date >= start && t.date <= end) {
      income += magnitude(t);
    }
  }
  const totals = categoryTotalsInRange(transactions, start, end);
  const kinds: CategoryKind[] = ["fixed", "essential", "discretionary"];
  const groups = kinds
    .map((kind) => {
      const rows = totals.filter(
        (c) => categoryKind(c.category, categories) === kind
      );
      const top = rows
        .slice(0, perGroup)
        .map((c) => ({ name: c.category, amount: c.amount }));
      const rest = rows.slice(perGroup).reduce((s, c) => s + c.amount, 0);
      if (rest > 0) {
        top.push({ name: `Other ${KIND_LABELS[kind].toLowerCase()}`, amount: rest });
      }
      return {
        kind,
        total: rows.reduce((s, c) => s + c.amount, 0),
        categories: top,
      };
    })
    .filter((g) => g.total > 0);
  const spent = groups.reduce((s, g) => s + g.total, 0);
  return { income, spent, saved: income - spent, groups };
}
