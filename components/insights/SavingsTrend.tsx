"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCADWhole } from "@/lib/utils/currency";
import { savingsRateTrend, type SavingsMonth } from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

/** Rate kept across months, weighted by income (not an average of rates). */
function pooledRate(months: SavingsMonth[]): number | null {
  const income = months.reduce((s, m) => s + m.income, 0);
  const spent = months.reduce((s, m) => s + m.spent, 0);
  return income > 0 ? ((income - spent) / income) * 100 : null;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SavingsMonth }[];
}) {
  const m = payload?.[0]?.payload;
  if (!active || !m) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="font-medium">
        {m.label}
        {m.partial && " (so far)"}
      </p>
      <p>
        Kept{" "}
        <span className="font-medium">
          {m.rate === null ? "—" : `${Math.round(m.rate)}%`}
        </span>
      </p>
      <p className="text-muted-foreground">
        In {formatCADWhole(m.income)} · out {formatCADWhole(m.spent)} · saved{" "}
        {formatCADWhole(m.saved)}
      </p>
    </div>
  );
}

/** Share of income kept each month over the last year. */
export function SavingsTrend({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const months = useMemo(() => savingsRateTrend(transactions), [transactions]);
  const complete = months.filter((m) => !m.partial);
  const recent = pooledRate(complete.slice(-3));
  const prior = pooledRate(complete.slice(-6, -3));
  const hasData = months.some((m) => m.rate !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings rate</CardTitle>
        <CardDescription>
          {recent === null ? (
            "Share of income you keep each month."
          ) : (
            <>
              You kept{" "}
              <span
                className={cn(
                  "font-medium",
                  recent >= 0 ? "text-foreground" : "text-destructive"
                )}
              >
                {Math.round(recent)}%
              </span>{" "}
              of your income over the last 3 months
              {prior !== null && Math.abs(recent - prior) >= 1 && (
                <>
                  , {recent > prior ? "up" : "down"} from {Math.round(prior)}%
                </>
              )}
              .
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Your savings rate appears once income shows up in transactions.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={months}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                />
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{
                    stroke: "var(--muted-foreground)",
                    strokeDasharray: "3 3",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
