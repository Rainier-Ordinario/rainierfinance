"use client";

import { endOfWeek, startOfWeek } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD } from "@/lib/utils/currency";
import { currentMonthRange, toISODate } from "@/lib/utils/dates";
import { budgetProgress } from "@/lib/utils/budgets";
import { spendOf } from "@/lib/utils/aggregate";
import { cn } from "@/lib/utils";
import type { Budget, Transaction } from "@/types";

function spentBetween(
  transactions: Transaction[],
  categories: Set<string>,
  start: string,
  end: string
): number {
  return transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        categories.has(t.category) &&
        t.date >= start &&
        t.date <= end
    )
    .reduce((s, t) => s + spendOf(t), 0);
}

export function BudgetsReview({
  budgets,
  transactions,
}: {
  budgets: Budget[];
  transactions: Transaction[];
}) {
  const categories = new Set(
    budgets.map((b) => b.category).filter((c): c is string => !!c)
  );
  const now = new Date();
  const week = {
    start: toISODate(startOfWeek(now, { weekStartsOn: 1 })),
    end: toISODate(endOfWeek(now, { weekStartsOn: 1 })),
  };
  const month = currentMonthRange(now);

  const weekSpent = spentBetween(transactions, categories, week.start, week.end);
  const monthSpent = spentBetween(
    transactions,
    categories,
    month.start,
    month.end
  );

  const trending = budgets
    .map((b) => ({ budget: b, progress: budgetProgress(b, transactions, now) }))
    .filter(({ progress }) => progress.status !== "on_track");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              This week, budgeted categories
            </p>
            <p className="text-numeric font-medium">{formatCAD(weekSpent)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              This month, budgeted categories
            </p>
            <p className="text-numeric font-medium">{formatCAD(monthSpent)}</p>
          </div>
        </div>

        {trending.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-sm text-muted-foreground">
            All budgets are on pace. Nice.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {trending.map(({ budget, progress }) => (
              <li
                key={budget.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">
                  <span aria-hidden>{budget.emoji}</span> {budget.name}
                </span>
                <span
                  className={cn(
                    "text-numeric shrink-0",
                    progress.status === "over"
                      ? "text-destructive"
                      : "text-warning"
                  )}
                >
                  {progress.status === "over"
                    ? `${formatCAD(Math.abs(progress.remaining))} over`
                    : `heading for ${formatCAD(progress.projected)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
