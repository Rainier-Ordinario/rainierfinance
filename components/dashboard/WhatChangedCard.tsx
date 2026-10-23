"use client";

import { useMemo } from "react";
import Link from "next/link";
import { addDays, endOfMonth, parseISO, subMonths } from "date-fns";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { formatCADWhole } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import {
  categoryKind,
  whatChanged,
  type CategoryChange,
} from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

type Period = "week" | "month";

/** Below this usual spend, a percentage change is noise ("+2400%"). */
const MIN_USUAL_FOR_PCT = 20;

/** How many earlier periods make up "usual". */
const BASELINE_COUNT: Record<Period, number> = { week: 4, month: 3 };

function baselinesFor(period: Period, start: string) {
  const from = parseISO(start);
  return Array.from({ length: BASELINE_COUNT[period] }, (_, i) => {
    if (period === "week") {
      const s = addDays(from, -7 * (i + 1));
      return { start: toISODate(s), end: toISODate(addDays(s, 6)) };
    }
    const s = subMonths(from, i + 1);
    return { start: toISODate(s), end: toISODate(endOfMonth(s)) };
  });
}

function ChangeRow({
  change,
  categories,
  range,
}: {
  change: CategoryChange;
  categories: Category[];
  range: { start: string; end: string };
}) {
  const up = change.diff > 0;
  const params = new URLSearchParams({
    type: "expense",
    category: change.category,
    from: range.start,
    to: range.end,
  });
  return (
    <li>
      <Link
        href={`/transactions?${params}`}
        className="-mx-2 block rounded-lg px-2 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <CategoryIcon category={change.category} categories={categories} />
            <span className="truncate">{change.category}</span>
          </span>
          <span
            className={cn(
              "shrink-0 text-numeric text-sm font-medium",
              up ? "text-destructive" : "text-success"
            )}
          >
            {up ? "+" : "−"}
            {formatCADWhole(Math.abs(change.diff))}
            {change.pct !== null && change.usual >= MIN_USUAL_FOR_PCT && (
              <span className="ml-1 text-xs font-normal">
                ({up ? "+" : "−"}
                {Math.round(Math.abs(change.pct) * 100)}%)
              </span>
            )}
          </span>
        </div>
        <p className="mt-0.5 pl-9 text-xs text-muted-foreground">
          {formatCADWhole(change.amount)} vs usual{" "}
          {formatCADWhole(change.usual)}
        </p>
        {change.merchants.length > 0 && (
          <ul className="mt-1 space-y-0.5 pl-9 text-xs text-muted-foreground">
            {change.merchants.map((m) => (
              <li key={m.name} className="flex justify-between gap-2">
                <span className="truncate">
                  {m.usual === 0 ? "New: " : ""}
                  {m.name}
                </span>
                <span className="shrink-0 text-numeric">
                  {m.diff > 0 ? "+" : "−"}
                  {formatCADWhole(Math.abs(m.diff))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </li>
  );
}

/**
 * The recap's "why": which categories moved most against a usual period,
 * and which merchants drove each move.
 */
export function WhatChangedCard({
  transactions,
  categories,
  period,
  start,
  end,
  isCurrent,
}: {
  transactions: Transaction[];
  categories: Category[];
  period: Period;
  start: string;
  end: string;
  isCurrent: boolean;
}) {
  // Monthly bills land in one week out of four, so week-to-week they read
  // as huge swings that say nothing about habits. Weeks compare everyday
  // spending only.
  const excludesFixed = period === "week";
  const result = useMemo(() => {
    const txs = excludesFixed
      ? transactions.filter(
          (t) => categoryKind(t.category, categories) !== "fixed"
        )
      : transactions;
    return whatChanged(txs, { start, end }, baselinesFor(period, start), {
      partial: isCurrent,
    });
  }, [transactions, categories, excludesFixed, period, start, end, isCurrent]);
  const subject = excludesFixed ? "Everyday spending" : "Spending";

  const range = { start, end };
  const total = Math.abs(result.totalDiff);
  const noteworthyTotal = total >= 20 && total >= result.usualTotal * 0.05;
  const empty = result.up.length === 0 && result.down.length === 0;

  let headline: string;
  if (result.usualTotal === 0) {
    headline = `Not enough history yet to know what a usual ${period} looks like.`;
  } else if (isCurrent) {
    headline =
      result.up.length === 0
        ? `So far, nothing is running above a usual ${period}.`
        : `So far, ${result.up.length === 1 ? "one category is" : `${result.up.length} categories are`} already above a usual ${period}.`;
  } else if (!noteworthyTotal) {
    headline = `${subject} was about the same as a usual ${period} (${formatCADWhole(result.usualTotal)}).`;
  } else {
    headline = `${subject} was ${formatCADWhole(total)} ${result.totalDiff > 0 ? "higher" : "lower"} than a usual ${period} (${formatCADWhole(result.usualTotal)}).`;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>What changed</CardTitle>
        <CardDescription>
          {headline} &ldquo;Usual&rdquo; is your average over the{" "}
          {BASELINE_COUNT[period]} {period}s before
          {excludesFixed && "; fixed bills are left out of weekly comparisons"}.
        </CardDescription>
      </CardHeader>
      {!empty && (
        <CardContent>
          <div
            className={cn(
              "grid gap-6",
              result.up.length > 0 && result.down.length > 0 && "md:grid-cols-2"
            )}
          >
            {result.up.length > 0 && (
              <section>
                <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <TrendingUp
                    className="size-3.5 text-destructive"
                    aria-hidden
                  />
                  Spent more
                </h3>
                <ul>
                  {result.up.map((c) => (
                    <ChangeRow
                      key={c.category}
                      change={c}
                      categories={categories}
                      range={range}
                    />
                  ))}
                </ul>
              </section>
            )}
            {result.down.length > 0 && (
              <section>
                <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <TrendingDown className="size-3.5 text-success" aria-hidden />
                  Spent less
                </h3>
                <ul>
                  {result.down.map((c) => (
                    <ChangeRow
                      key={c.category}
                      change={c}
                      categories={categories}
                      range={range}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
