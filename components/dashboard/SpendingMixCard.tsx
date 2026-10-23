"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCADWhole } from "@/lib/utils/currency";
import { KIND_LABELS, spendingMix } from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind, Transaction } from "@/types";

const KINDS: CategoryKind[] = ["fixed", "essential", "discretionary"];

const KIND_COLORS: Record<CategoryKind, string> = {
  fixed: "var(--chart-5)",
  essential: "var(--chart-2)",
  discretionary: "var(--chart-1)",
};

/** Ignore pace differences under this — noise, not a habit. */
const NOTABLE_DIFF = 10;

/**
 * This month's spending split into fixed bills, essentials, and
 * discretionary wants, each paced against last month at the same point.
 * Discretionary is where habits show, so it gets the headline.
 */
export function SpendingMixCard({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const mix = useMemo(
    () => spendingMix(transactions, categories),
    [transactions, categories]
  );
  const total = KINDS.reduce((sum, k) => sum + mix.current[k], 0);
  const paceDiff =
    mix.current.discretionary - mix.lastMonthSamePoint.discretionary;
  const hasHistory = KINDS.some((k) => mix.monthlyAverage[k] > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Where it goes</CardTitle>
          <CardDescription>This month, by type of spending</CardDescription>
        </div>
        <Link
          href="/settings#category-groups"
          className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Edit groups
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {total > 0 ? (
          <div
            className="flex h-3 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={KINDS.map(
              (k) => `${KIND_LABELS[k]} ${formatCADWhole(mix.current[k])}`
            ).join(", ")}
          >
            {KINDS.map((k) =>
              mix.current[k] > 0 ? (
                <div
                  key={k}
                  style={{
                    width: `${(mix.current[k] / total) * 100}%`,
                    background: KIND_COLORS[k],
                  }}
                />
              ) : null
            )}
          </div>
        ) : (
          <div className="h-3 rounded-full bg-muted" aria-hidden />
        )}

        <ul className="space-y-2.5">
          {KINDS.map((k) => {
            const diff = mix.current[k] - mix.lastMonthSamePoint[k];
            const notable = Math.abs(diff) >= NOTABLE_DIFF;
            return (
              <li key={k} className="flex items-start justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: KIND_COLORS[k] }}
                    aria-hidden
                  />
                  {KIND_LABELS[k]}
                </span>
                <span className="text-right">
                  <span className="text-numeric font-medium">
                    {formatCADWhole(mix.current[k])}
                  </span>
                  {mix.monthlyAverage[k] > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      usually {formatCADWhole(mix.monthlyAverage[k])}/mo
                      {notable && k !== "fixed" && (
                        <span
                          className={cn(
                            "ml-1",
                            diff > 0 ? "text-destructive" : "text-success"
                          )}
                        >
                          · {diff > 0 ? "+" : "−"}
                          {formatCADWhole(Math.abs(diff))} vs last month
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {hasHistory && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            {Math.abs(paceDiff) < NOTABLE_DIFF ? (
              <>
                Discretionary spending is on the same pace as this point last
                month.
              </>
            ) : (
              <>
                Discretionary spending is{" "}
                <span
                  className={cn(
                    "font-medium",
                    paceDiff > 0 ? "text-destructive" : "text-success"
                  )}
                >
                  {formatCADWhole(Math.abs(paceDiff))}{" "}
                  {paceDiff > 0 ? "higher" : "lower"}
                </span>{" "}
                than at this point last month.
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
