"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { WidgetEmpty } from "@/components/shared/WidgetEmpty";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import { categoryTrends, type CategoryTrend } from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

type SortBy = "spend" | "rising" | "falling";

/** Changes smaller than this read as steady. */
const NOTABLE_CHANGE = 0.1;
/** Ignore trends in categories that cost less than this a month. */
const MIN_MONTHLY = 20;
const INITIAL_VISIBLE = 9;

function sortTrends(trends: CategoryTrend[], by: SortBy): CategoryTrend[] {
  if (by === "spend") return trends;
  const moving = trends.filter(
    (t) =>
      t.change !== null &&
      Math.max(t.recentAvg, t.priorAvg) >= MIN_MONTHLY &&
      (by === "rising" ? t.change >= NOTABLE_CHANGE : t.change <= -NOTABLE_CHANGE)
  );
  // Rank by dollars moved, not percent: +$200/mo matters more than +80% of $10.
  return moving.sort((a, b) =>
    by === "rising"
      ? b.recentAvg - b.priorAvg - (a.recentAvg - a.priorAvg)
      : a.recentAvg - a.priorAvg - (b.recentAvg - b.priorAvg)
  );
}

function ChangeLabel({ trend }: { trend: CategoryTrend }) {
  if (trend.change === null) {
    return <span className="text-muted-foreground">new</span>;
  }
  if (Math.abs(trend.change) < NOTABLE_CHANGE) {
    return <span className="text-muted-foreground">steady</span>;
  }
  const up = trend.change > 0;
  return (
    <span className={up ? "text-destructive" : "text-success"}>
      {up ? "▲" : "▼"} {Math.round(Math.abs(trend.change) * 100)}%
    </span>
  );
}

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Stable per-name fallback so a category keeps its color when re-sorted. */
function fallbackColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function TrendCard({
  trend,
  categories,
}: {
  trend: CategoryTrend;
  categories: Category[];
}) {
  const color =
    categories.find((c) => c.name === trend.category)?.color ??
    fallbackColor(trend.category);
  const params = new URLSearchParams({
    type: "expense",
    category: trend.category,
  });

  return (
    <Link
      href={`/transactions?${params}`}
      className="group block rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${trend.category}: ${formatCADWhole(trend.recentAvg)} a month lately. See transactions`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <CategoryIcon category={trend.category} categories={categories} />
          <span className="truncate">{trend.category}</span>
        </span>
        <span className="shrink-0 text-xs font-medium">
          <ChangeLabel trend={trend} />
        </span>
      </div>
      <p className="mt-2 text-numeric text-lg font-semibold">
        {formatCADWhole(trend.recentAvg)}
        <span className="text-xs font-normal text-muted-foreground">
          /mo lately
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        was {formatCADWhole(trend.priorAvg)}/mo the 3 months before
      </p>
      <div className="mt-3 h-20" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend.months} barCategoryGap={2}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={2}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              height={16}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              formatter={(value) => [formatCAD(Number(value)), trend.category]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.partial ? `${label} (so far)` : label
              }
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {trend.months.map((m) => (
                <Cell
                  key={m.start}
                  fill={color}
                  fillOpacity={m.partial ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Link>
  );
}


/**
 * Small multiples: one 12-month chart per category, so slow creep in any
 * single category is visible without being drowned out by rent.
 */
export function CategoryTrends({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [sortBy, setSortBy] = useState<SortBy>("spend");
  const [showAll, setShowAll] = useState(false);
  const trends = useMemo(() => categoryTrends(transactions), [transactions]);
  const sorted = useMemo(() => sortTrends(trends, sortBy), [trends, sortBy]);
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Category trends</CardTitle>
          <CardDescription>
            Last 12 months. &ldquo;Lately&rdquo; is the average of the last 3
            complete months; each chart has its own scale.
          </CardDescription>
        </div>
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <TabsList>
            <TabsTrigger value="spend">Biggest</TabsTrigger>
            <TabsTrigger value="rising">Rising</TabsTrigger>
            <TabsTrigger value="falling">Falling</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <WidgetEmpty
            message="Trends appear once you have a few months of spending."
            actionLabel="Import transactions"
            actionHref="/transactions"
          />
        ) : sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {sortBy === "rising"
              ? "Nothing is climbing: no category is up 10% or more lately."
              : "Nothing is dropping: no category is down 10% or more lately."}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((t) => (
                <TrendCard key={t.category} trend={t} categories={categories} />
              ))}
            </div>
            {sorted.length > INITIAL_VISIBLE && (
              <div className="mt-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll((v) => !v)}
                  className={cn(showAll && "text-muted-foreground")}
                >
                  {showAll ? "Show fewer" : `Show all ${sorted.length}`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
