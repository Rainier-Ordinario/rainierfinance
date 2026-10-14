"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { WidgetEmpty } from "@/components/shared/WidgetEmpty";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import type { MonthCashFlow } from "@/lib/utils/aggregate";

export function CashFlowChart({ data }: { data: MonthCashFlow[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetEmpty
            message="Cash flow appears here once you have transactions."
            actionLabel="Add or import transactions"
            actionHref="/transactions"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
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
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(v) => formatCADWhole(Number(v))}
                width={70}
              />
              <Tooltip
                formatter={(value) => formatCAD(Number(value))}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
