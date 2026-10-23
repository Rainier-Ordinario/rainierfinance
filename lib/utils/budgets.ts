import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  endOfWeek,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { spendOf } from "@/lib/utils/aggregate";
import { toISODate } from "@/lib/utils/dates";
import {
  categoryKind,
  NOT_SPENDING,
  UNCATEGORIZED,
} from "@/lib/utils/spending";
import type { Budget, Category, Transaction } from "@/types";

/** Current period window for a budget (weekly weeks start Monday). */
export function budgetPeriodRange(budget: Budget, now = new Date()) {
  switch (budget.period) {
    case "weekly":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "yearly":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: budget.start_date ? parseISO(budget.start_date) : startOfMonth(now),
        end: budget.end_date ? parseISO(budget.end_date) : endOfMonth(now),
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

/** Expense transactions matching this budget in its current period. */
export function budgetTransactions(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): Transaction[] {
  const { start, end } = budgetPeriodRange(budget, now);
  const startIso = toISODate(start);
  const endIso = toISODate(end);
  return transactions.filter(
    (t) =>
      t.type === "expense" &&
      t.category === budget.category &&
      t.date >= startIso &&
      t.date <= endIso
  );
}

export interface BudgetProgress {
  spent: number;
  remaining: number;
  pctSpent: number; // 0–100+
  pctElapsed: number; // 0–100
  projected: number; // spend at current pace by period end
  daysLeft: number;
  status: "on_track" | "watch" | "over";
}

/**
 * Spent is computed live from transactions (the stored spent_amount cache is
 * ignored for correctness).
 */
export function budgetProgress(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): BudgetProgress {
  const { start, end } = budgetPeriodRange(budget, now);
  const spent = budgetTransactions(budget, transactions, now).reduce(
    (s, t) => s + spendOf(t),
    0
  );
  const total = Number(budget.total_amount);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const elapsedDays = Math.min(
    Math.max(differenceInCalendarDays(now, start) + 1, 1),
    totalDays
  );
  const pctSpent = total > 0 ? (spent / total) * 100 : 0;
  const pctElapsed = (elapsedDays / totalDays) * 100;
  const projected = (spent / elapsedDays) * totalDays;

  let status: BudgetProgress["status"] = "on_track";
  if (pctSpent >= 100) status = "over";
  else if (projected > total) status = "watch";

  return {
    spent,
    remaining: total - spent,
    pctSpent,
    pctElapsed,
    projected,
    daysLeft: totalDays - elapsedDays,
    status,
  };
}

export interface DailySpendPoint {
  day: number;
  label: string;
  cumulative: number | null; // null after today (no line drawn)
  ideal: number; // straight-line pace to budget total
}

/** Daily cumulative spend across the period vs the ideal straight-line pace. */
export function dailySpendSeries(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): DailySpendPoint[] {
  const { start, end } = budgetPeriodRange(budget, now);
  const txs = budgetTransactions(budget, transactions, now);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const today = Math.min(
    Math.max(differenceInCalendarDays(now, start) + 1, 1),
    totalDays
  );
  const total = Number(budget.total_amount);

  const byDay = new Map<number, number>();
  for (const t of txs) {
    const day = differenceInCalendarDays(parseISO(t.date), start) + 1;
    byDay.set(day, (byDay.get(day) ?? 0) + spendOf(t));
  }

  const points: DailySpendPoint[] = [];
  let cumulative = 0;
  for (let day = 1; day <= totalDays; day++) {
    cumulative += byDay.get(day) ?? 0;
    points.push({
      day,
      label: String(day),
      cumulative: day <= today ? Math.round(cumulative * 100) / 100 : null,
      ideal: Math.round((total / totalDays) * day * 100) / 100,
    });
  }
  return points;
}

// ---------- Suggestions from history ----------

const CATEGORY_EMOJI: Record<string, string> = {
  Groceries: "🛒",
  Dining: "🍽️",
  "Food Delivery": "🛵",
  Shopping: "🛍️",
  Entertainment: "🎮",
  Rideshare: "🚗",
  Gas: "⛽",
  Transit: "🚆",
  Health: "💊",
  Streaming: "📺",
  Subscriptions: "🔁",
  Education: "🎓",
  Bills: "🧾",
};

export const DEFAULT_BUDGET_EMOJI = "💰";

export function budgetEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? DEFAULT_BUDGET_EMOJI;
}

/** Round to an amount a person would actually type into a budget. */
export function roundBudget(amount: number): number {
  const step = amount < 100 ? 5 : amount < 500 ? 10 : amount < 2000 ? 25 : 50;
  return Math.max(step, Math.round(amount / step) * step);
}

export interface BudgetSuggestion {
  /** Average spend per budget period, from history. */
  usual: number;
  /** `usual`, rounded. */
  suggested: number;
  /** About 10% under usual, rounded: a gentle stretch goal. */
  trimmed: number;
  /** Complete months of history behind the average. */
  months: number;
}

type SuggestPeriod = "monthly" | "weekly" | "yearly";

/**
 * What a budget for `category` would be if it matched recent habits: the
 * average over the last 3 complete months (12 for yearly budgets), counting
 * only months since the user's transaction history begins so a new account
 * isn't averaged down by empty months.
 */
export function budgetSuggestion(
  transactions: Transaction[],
  category: string,
  period: SuggestPeriod,
  now = new Date()
): BudgetSuggestion | null {
  if (transactions.length === 0) return null;
  const earliest = transactions.reduce(
    (d, t) => (t.date < d ? t.date : d),
    transactions[0].date
  );
  const lookback = period === "yearly" ? 12 : 3;
  const windowStart = startOfMonth(subMonths(now, lookback));
  const historyStart = startOfMonth(parseISO(earliest));
  const from = historyStart > windowStart ? historyStart : windowStart;
  const months = differenceInCalendarMonths(startOfMonth(now), from);
  if (months <= 0) return null;

  const start = toISODate(from);
  const end = toISODate(endOfMonth(subMonths(now, 1)));
  const total = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.category === category &&
        t.date >= start &&
        t.date <= end
    )
    .reduce((s, t) => s + spendOf(t), 0);

  const perMonth = total / months;
  const usual =
    period === "weekly"
      ? (perMonth * 12) / 52
      : period === "yearly"
        ? perMonth * 12
        : perMonth;
  if (usual < 1) return null;

  const suggested = roundBudget(usual);
  let trimmed = roundBudget(usual * 0.9);
  if (trimmed >= suggested) trimmed = roundBudget(suggested * 0.85);
  return { usual, suggested, trimmed, months };
}

export interface CategoryBudgetSuggestion extends BudgetSuggestion {
  category: Category;
}

/** Below this usual monthly spend a budget isn't worth the attention. */
const MIN_SUGGEST_MONTHLY = 50;

/**
 * Categories worth budgeting that don't have one yet: day-to-day spending
 * (not fixed bills or uncategorized), biggest usual spend first.
 */
export function suggestBudgets(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  limit = 4,
  now = new Date()
): CategoryBudgetSuggestion[] {
  const budgeted = new Set(budgets.map((b) => b.category));
  return categories
    .filter(
      (c) =>
        c.type !== "income" &&
        !NOT_SPENDING.has(c.name) &&
        // Sorting "Other" into real categories beats budgeting it.
        c.name !== UNCATEGORIZED &&
        !budgeted.has(c.name) &&
        categoryKind(c.name, categories) !== "fixed"
    )
    .map((c) => {
      const s = budgetSuggestion(transactions, c.name, "monthly", now);
      return s ? { ...s, category: c } : null;
    })
    .filter(
      (s): s is CategoryBudgetSuggestion =>
        s !== null && s.usual >= MIN_SUGGEST_MONTHLY
    )
    .sort((a, b) => b.usual - a.usual)
    .slice(0, limit);
}
