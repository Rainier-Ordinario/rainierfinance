import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toISODate } from "@/lib/utils/dates";
import type { Budget, Transaction } from "@/types";

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
    (s, t) => s + Math.abs(Number(t.amount)),
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
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(Number(t.amount)));
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
