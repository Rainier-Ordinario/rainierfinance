import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  getDate,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { spendOf } from "@/lib/utils/aggregate";
import { roundBudget } from "@/lib/utils/budgets";
import { toISODate } from "@/lib/utils/dates";
import {
  categoryKind,
  NOT_SPENDING,
  UNCATEGORIZED,
} from "@/lib/utils/spending";
import type { Category, Challenge, Transaction } from "@/types";

export type ChallengeStatus = "won" | "lost" | "on_track" | "at_risk";

export interface ChallengeProgress {
  /** Dollars spent (category_cap) or no-spend days so far (no_spend_days). */
  value: number;
  target: number;
  /** 0–100 toward the cap (or toward the day count). */
  pct: number;
  daysLeft: number;
  status: ChallengeStatus;
  /** no_spend_days only: consecutive no-spend days ending yesterday. */
  streak?: number;
  /** category_cap only: spend at the current pace by month end. */
  projected?: number;
}

/**
 * Where a challenge stands. A finished month is won or lost; a running one
 * is on track or at risk based on pace (cap) or whether enough days remain
 * (no-spend days).
 */
export function challengeProgress(
  challenge: Challenge,
  transactions: Transaction[],
  categories: Category[],
  now = new Date()
): ChallengeProgress {
  const start = parseISO(challenge.month);
  const end = endOfMonth(start);
  const totalDays = getDate(end);
  const finished = now > end;
  const today = finished ? end : now;
  const elapsed = Math.min(totalDays, Math.max(1, differenceInCalendarDays(today, start) + 1));
  const daysLeft = finished ? 0 : totalDays - elapsed;
  const startIso = toISODate(start);
  const endIso = toISODate(end);
  const inMonth = transactions.filter(
    (t) => t.type === "expense" && t.date >= startIso && t.date <= endIso
  );
  const target = Number(challenge.target);

  if (challenge.kind === "category_cap") {
    const value = inMonth
      .filter((t) => t.category === challenge.category)
      .reduce((s, t) => s + spendOf(t), 0);
    const projected = (value / elapsed) * totalDays;
    const status: ChallengeStatus =
      value > target
        ? "lost"
        : finished
          ? "won"
          : projected > target
            ? "at_risk"
            : "on_track";
    return {
      value,
      target,
      pct: target > 0 ? Math.min(100, (value / target) * 100) : 0,
      daysLeft,
      status,
      projected,
    };
  }

  // no_spend_days: days with no discretionary purchases. Today only counts
  // once it's over.
  const spendDays = new Set(
    inMonth
      .filter(
        (t) =>
          spendOf(t) > 0 &&
          categoryKind(t.category, categories) === "discretionary"
      )
      .map((t) => t.date)
  );
  const countedDays = finished ? totalDays : elapsed - 1;
  let value = 0;
  for (let i = 0; i < countedDays; i++) {
    if (!spendDays.has(toISODate(addDays(start, i)))) value++;
  }
  let streak = 0;
  for (let i = countedDays - 1; i >= 0; i--) {
    if (spendDays.has(toISODate(addDays(start, i)))) break;
    streak++;
  }
  const stillPossible = value + (totalDays - countedDays);
  const status: ChallengeStatus =
    value >= target
      ? "won"
      : finished || stillPossible < target
        ? "lost"
        : // At risk once more than half the remaining days must be no-spend.
          target - value > (totalDays - countedDays) / 2
          ? "at_risk"
          : "on_track";
  return {
    value,
    target,
    pct: target > 0 ? Math.min(100, (value / target) * 100) : 0,
    daysLeft,
    status,
    streak,
  };
}

export interface ChallengeSuggestion {
  category: string;
  usual: number;
  cap: number;
}

/**
 * A cap worth trying: the biggest discretionary category, about 20% under
 * its usual month, skipping categories that already have a challenge.
 */
export function suggestCapChallenges(
  transactions: Transaction[],
  categories: Category[],
  taken: string[],
  limit = 3,
  now = new Date()
): ChallengeSuggestion[] {
  const start = toISODate(startOfMonth(subMonths(now, 3)));
  const end = toISODate(endOfMonth(subMonths(now, 1)));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.date < start || t.date > end) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + spendOf(t));
  }
  return [...totals.entries()]
    .filter(
      ([category, total]) =>
        total / 3 >= 30 &&
        !taken.includes(category) &&
        !NOT_SPENDING.has(category) &&
        category !== UNCATEGORIZED &&
        categoryKind(category, categories) === "discretionary"
    )
    .map(([category, total]) => ({
      category,
      usual: total / 3,
      cap: roundBudget((total / 3) * 0.8),
    }))
    .sort((a, b) => b.usual - a.usual)
    .slice(0, limit);
}
