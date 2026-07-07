"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cashFlowByMonth,
  cashFlowByWeek,
  type MonthCashFlow,
} from "@/lib/utils/aggregate";
import {
  formatCAD,
  formatCADWhole,
  formatPercentSigned,
} from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types";

type Granularity = "week" | "month";

const TITLES: Record<string, string> = {
  income: "Income history",
  expense: "Spending history",
  transfer: "Cash flow history",
  all: "Cash flow history",
};

export function TrendPanel({
  transactions,
  type,
}: {
  transactions: Transaction[];
  /** Active type filter; undefined = all types. */
  type?: TransactionType;
}) {
  const [granularity, setGranularity] = useState<Granularity>("month");

  const data: MonthCashFlow[] = useMemo(
    () =>
      granularity === "week"
        ? cashFlowByWeek(transactions, 12)
        : cashFlowByMonth(transactions, 12),
    [transactions, granularity]
  );

  const focus: "income" | "expenses" | "both" =
    type === "income" ? "income" : type === "expense" ? "expenses" : "both";

  const series = useMemo(() => {
    const values = data.map((d) =>
      focus === "income"
        ? d.income
        : focus === "expenses"
          ? d.expenses
          : d.income - d.expenses
    );
    const current = values[values.length - 1] ?? 0;
    const previous = values[values.length - 2] ?? 0;
    const nonEmpty = values.filter((v) => v !== 0);
    const average =
      nonEmpty.length > 0
        ? nonEmpty.reduce((s, v) => s + v, 0) / nonEmpty.length
        : 0;
    const delta = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
    return { current, previous, average, delta };
  }, [data, focus]);

  const periodNoun = granularity === "week" ? "week" : "month";
  const deltaGood =
    focus === "expenses"
      ? (series.delta ?? 0) <= 0
      : (series.delta ?? 0) >= 0;

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{TITLES[type ?? "all"]}</CardTitle>
        <Tabs
          value={granularity}
          onValueChange={(v) => setGranularity(v as Granularity)}
        >
          <TabsList>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {/* Summary strip */}
        <div className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <p className="text-xs text-muted-foreground">This {periodNoun}</p>
            <p className="text-numeric text-xl font-semibold">
              {formatCAD(series.current)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last {periodNoun}</p>
            <p className="text-numeric text-base font-medium text-muted-foreground">
              {formatCAD(series.previous)}
              {series.delta !== null && (
                <span
                  className={cn(
                    "ml-2 text-xs font-semibold",
                    deltaGood ? "text-success" : "text-destructive"
                  )}
                >
                  {formatPercentSigned(series.delta, 0)}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Average per {periodNoun}
            </p>
            <p className="text-numeric text-base font-medium text-muted-foreground">
              {formatCAD(series.average)}
            </p>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => formatCADWhole(Number(v))}
                width={64}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCAD(Number(value)),
                  name === "income" ? "Income" : "Spending",
                ]}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                }}
              />
              {(focus === "income" || focus === "both") && (
                <Bar
                  dataKey="income"
                  fill="var(--success)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              )}
              {(focus === "expenses" || focus === "both") && (
                <Bar
                  dataKey="expenses"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
