"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import {
  FOLDED_CATEGORIES,
  type CategoryTotal,
} from "@/lib/utils/aggregate";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#64748b",
];

/** A category's spend with its usual monthly amount, for comparisons. */
export type DonutRow = CategoryTotal & { perMonth?: number; baseline?: number };

/**
 * How each legend row compares against its usual month:
 * - "so_far": partial current period, show the usual monthly amount
 * - "delta": a whole period, show % above/below usual
 * - "per_month": a long period, show the monthly average
 */
export type DonutCompare = "so_far" | "delta" | "per_month";

/** Within ±10% of usual reads as normal, not as a change. */
const NOTABLE_CHANGE = 0.1;

function Comparison({ row, mode }: { row: DonutRow; mode: DonutCompare }) {
  const baseline = row.baseline ?? 0;
  if (mode === "per_month") {
    return <>{formatCADWhole(row.perMonth ?? row.amount)}/mo</>;
  }
  if (mode === "so_far") {
    if (baseline <= 0) return null;
    return (
      <span className={cn(row.amount > baseline && "text-warning")}>
        usual {formatCADWhole(baseline)}
      </span>
    );
  }
  if (baseline <= 0) return <>new</>;
  const change = (row.perMonth ?? row.amount) / baseline - 1;
  if (Math.abs(change) < NOTABLE_CHANGE) return <>≈ usual</>;
  return (
    <span className={change > 0 ? "text-destructive" : "text-success"}>
      {change > 0 ? "+" : "−"}
      {Math.round(Math.abs(change) * 100)}% vs usual
    </span>
  );
}

export function SpendingDonut({
  data,
  categories,
  emptyLabel = "No expenses recorded this month yet.",
  title = "Spending by Category",
  description,
  headerAction,
  range,
  compare,
}: {
  data: DonutRow[];
  categories: Category[];
  emptyLabel?: string;
  title?: string;
  description?: ReactNode;
  headerAction?: ReactNode;
  /** When set, clicking a category opens its transactions in this range. */
  range?: { start: string; end: string };
  compare?: DonutCompare;
}) {
  const router = useRouter();
  const drillable = (category: string) =>
    range !== undefined && category !== FOLDED_CATEGORIES;
  const open = (category: string) => {
    if (!range || !drillable(category)) return;
    const params = new URLSearchParams({
      type: "expense",
      category,
      from: range.start,
      to: range.end,
    });
    router.push(`/transactions?${params}`);
  };

  const colorFor = (category: string, index: number) =>
    category === FOLDED_CATEGORIES
      ? "var(--muted-foreground)"
      : (categories.find((c) => c.name === category)?.color ??
        FALLBACK_COLORS[index % FALLBACK_COLORS.length]);

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={(_, i) => open(data[i].category)}
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={entry.category}
                        fill={colorFor(entry.category, i)}
                        className={cn(
                          drillable(entry.category) && "cursor-pointer"
                        )}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCAD(Number(value))}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-1">
              {data.map((entry, i) => {
                const row = (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: colorFor(entry.category, i) }}
                        aria-hidden
                      />
                      <span className="truncate">{entry.category}</span>
                    </span>
                    <span className="shrink-0 text-right text-numeric text-muted-foreground">
                      {formatCAD(entry.amount)}
                      <span className="ml-1 text-xs">
                        (
                        {total > 0
                          ? Math.round((entry.amount / total) * 100)
                          : 0}
                        %)
                      </span>
                      {compare && entry.category !== FOLDED_CATEGORIES && (
                        <span className="block text-xs">
                          <Comparison row={entry} mode={compare} />
                        </span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={entry.category}>
                    {drillable(entry.category) ? (
                      <button
                        type="button"
                        onClick={() => open(entry.category)}
                        className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        aria-label={`See ${entry.category} transactions`}
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2 py-1 text-sm">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
