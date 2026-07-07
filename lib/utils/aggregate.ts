import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import type { Account, Transaction } from "@/types";
import { currentMonthRange, monthRange } from "@/lib/utils/dates";
import { toISODate } from "@/lib/utils/dates";

const LIABILITY_TYPES = new Set(["credit_card"]);

export function totalAssets(accounts: Account[]): number {
  return accounts
    .filter((a) => a.is_active && !LIABILITY_TYPES.has(a.type))
    .reduce((sum, a) => sum + Number(a.balance), 0);
}

export function totalLiabilities(accounts: Account[]): number {
  return accounts
    .filter((a) => a.is_active && LIABILITY_TYPES.has(a.type))
    .reduce((sum, a) => sum + Number(a.balance), 0);
}

export function netWorth(accounts: Account[]): number {
  return totalAssets(accounts) - totalLiabilities(accounts);
}

function inRange(t: Transaction, start: string, end: string): boolean {
  return t.date >= start && t.date <= end;
}

export function monthlyExpenses(
  transactions: Transaction[],
  start: string,
  end: string
): number {
  return transactions
    .filter((t) => t.type === "expense" && inRange(t, start, end))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
}

export function monthlyIncome(
  transactions: Transaction[],
  start: string,
  end: string
): number {
  return transactions
    .filter((t) => t.type === "income" && inRange(t, start, end))
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

export function savingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return ((income - expenses) / income) * 100;
}

export interface MonthCashFlow {
  label: string;
  income: number;
  expenses: number;
}

/** Income vs expenses for the last `months` months, oldest first. */
export function cashFlowByMonth(
  transactions: Transaction[],
  months = 6,
  now = new Date()
): MonthCashFlow[] {
  const result: MonthCashFlow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const { start, end, label } = monthRange(i, now);
    result.push({
      label,
      income: monthlyIncome(transactions, start, end),
      expenses: monthlyExpenses(transactions, start, end),
    });
  }
  return result;
}

/** Income vs expenses for the last `weeks` Monday-based weeks, oldest first. */
export function cashFlowByWeek(
  transactions: Transaction[],
  weeks = 12,
  now = new Date()
): MonthCashFlow[] {
  const result: MonthCashFlow[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const startIso = toISODate(start);
    const endIso = toISODate(addDays(start, 6));
    result.push({
      label: format(start, "MMM d"),
      income: monthlyIncome(transactions, startIso, endIso),
      expenses: monthlyExpenses(transactions, startIso, endIso),
    });
  }
  return result;
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

/** Expense totals per category within a date range, biggest first. */
export function categoryTotalsInRange(
  transactions: Transaction[],
  start: string,
  end: string
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || !inRange(t, start, end)) continue;
    totals.set(
      t.category,
      (totals.get(t.category) ?? 0) + Math.abs(Number(t.amount))
    );
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Expense totals per category for the current month, biggest first. */
export function categoryTotals(
  transactions: Transaction[],
  now = new Date()
): CategoryTotal[] {
  const { start, end } = currentMonthRange(now);
  return categoryTotalsInRange(transactions, start, end);
}

/** Top N categories with the remainder folded into "Other". */
export function topCategories(
  totals: CategoryTotal[],
  n = 6
): CategoryTotal[] {
  if (totals.length <= n) return totals;
  const top = totals.slice(0, n);
  const rest = totals.slice(n).reduce((sum, c) => sum + c.amount, 0);
  return [...top, { category: "Other", amount: rest }];
}
