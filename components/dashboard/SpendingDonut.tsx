"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD } from "@/lib/utils/currency";
import type { CategoryTotal } from "@/lib/utils/aggregate";
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

export function SpendingDonut({
  data,
  categories,
  emptyLabel = "No expenses recorded this month yet.",
}: {
  data: CategoryTotal[];
  categories: Category[];
  emptyLabel?: string;
}) {
  const colorFor = (category: string, index: number) =>
    categories.find((c) => c.name === category)?.color ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
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
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={entry.category}
                        fill={colorFor(entry.category, i)}
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
            <ul className="w-full space-y-2">
              {data.map((entry, i) => (
                <li
                  key={entry.category}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: colorFor(entry.category, i) }}
                      aria-hidden
                    />
                    {entry.category}
                  </span>
                  <span className="text-numeric text-muted-foreground">
                    {formatCAD(entry.amount)}
                    <span className="ml-1 text-xs">
                      ({total > 0 ? Math.round((entry.amount / total) * 100) : 0}
                      %)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
