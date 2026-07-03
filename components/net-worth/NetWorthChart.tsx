"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD } from "@/lib/utils/currency";
import type { NetWorthSnapshot } from "@/types";

export function NetWorthChart({
  snapshots,
}: {
  snapshots: NetWorthSnapshot[];
}) {
  const data = snapshots.map((s) => ({
    label: format(parseISO(s.snapshot_date), "MMM d"),
    netWorth: Number(s.net_worth),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Net Worth Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-8 text-center text-sm text-muted-foreground">
            Log at least two snapshots to see the trend.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(v) => formatCAD(Number(v))}
                  width={80}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value) => [formatCAD(Number(value)), "Net worth"]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#nw-fill)"
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
