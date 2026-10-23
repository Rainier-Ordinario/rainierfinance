import { differenceInCalendarMonths, parseISO } from "date-fns";
import { roundBudget } from "@/lib/utils/budgets";
import { savingsRateTrend, spendingMix } from "@/lib/utils/spending";
import type { Account, Category, Goal, Transaction } from "@/types";

export interface GoalProgress {
  current: number;
  remaining: number;
  /** 0–100. */
  pct: number;
  /** Whole months until the target date (at least 1); null without a date. */
  monthsLeft: number | null;
  /** What has to be put aside each month to hit the date; null without one. */
  neededPerMonth: number | null;
  /** Months to finish at the recent saving pace; null if not saving. */
  etaMonths: number | null;
  status: "done" | "on_track" | "behind" | "no_date";
}

/** Where a goal's money sits: a linked account's balance, or the manual amount. */
export function goalCurrent(goal: Goal, accounts: Account[]): number {
  if (goal.account_id) {
    const account = accounts.find((a) => a.id === goal.account_id);
    if (account) return Math.max(0, Number(account.balance));
  }
  return Number(goal.saved_amount);
}

/**
 * How a goal is going. "On track" compares the monthly amount the deadline
 * needs against what the user has actually been saving per month.
 */
export function goalProgress(
  goal: Goal,
  accounts: Account[],
  monthlySaving: number,
  now = new Date()
): GoalProgress {
  const target = Number(goal.target_amount);
  const current = goalCurrent(goal, accounts);
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const etaMonths =
    remaining === 0 ? 0 : monthlySaving > 0 ? Math.ceil(remaining / monthlySaving) : null;

  if (remaining === 0) {
    return { current, remaining, pct, monthsLeft: null, neededPerMonth: 0, etaMonths, status: "done" };
  }
  if (!goal.target_date) {
    return { current, remaining, pct, monthsLeft: null, neededPerMonth: null, etaMonths, status: "no_date" };
  }
  const monthsLeft = Math.max(
    1,
    differenceInCalendarMonths(parseISO(goal.target_date), now)
  );
  const neededPerMonth = remaining / monthsLeft;
  return {
    current,
    remaining,
    pct,
    monthsLeft,
    neededPerMonth,
    etaMonths,
    status: monthlySaving >= neededPerMonth ? "on_track" : "behind",
  };
}

/** Average amount actually saved per month over the last 3 complete months. */
export function recentMonthlySaving(
  transactions: Transaction[],
  now = new Date()
): number {
  const complete = savingsRateTrend(transactions, 4, now).slice(0, 3);
  const saved = complete.reduce((s, m) => s + m.saved, 0) / 3;
  return Math.max(0, saved);
}

const CASH_TYPES = new Set(["chequing", "savings"]);

export interface Runway {
  /** Usual monthly fixed bills + essentials. */
  monthlyNeeds: number;
  /** Chequing + savings balances. */
  cash: number;
  /** How many months of needs the cash covers; null without needs. */
  months: number | null;
  /** A 3-month emergency fund, rounded. */
  suggestedTarget: number;
}

/** How long cash on hand would cover the bills and essentials. */
export function emergencyRunway(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  now = new Date()
): Runway {
  const usual = spendingMix(transactions, categories, now).monthlyAverage;
  const monthlyNeeds = usual.fixed + usual.essential;
  const cash = accounts
    .filter((a) => a.is_active && CASH_TYPES.has(a.type))
    .reduce((s, a) => s + Number(a.balance), 0);
  return {
    monthlyNeeds,
    cash,
    months: monthlyNeeds > 0 ? cash / monthlyNeeds : null,
    suggestedTarget: monthlyNeeds > 0 ? roundBudget(monthlyNeeds * 3) : 0,
  };
}
