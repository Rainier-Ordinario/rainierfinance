"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD, formatCADSigned, formatPercentSigned } from "@/lib/utils/currency";
import { WidgetEmpty } from "@/components/shared/WidgetEmpty";
import { cn } from "@/lib/utils";
import type { Investment } from "@/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
];

export function InvestmentSummary({ holdings }: { holdings: Investment[] }) {
  const totalValue = holdings.reduce(
    (s, h) => s + Number(h.market_value ?? 0),
    0
  );
  const totalGain = holdings.reduce(
    (s, h) => s + Number(h.unrealized_gain ?? 0),
    0
  );
  const bookValue = totalValue - totalGain;
  const gainPct = bookValue > 0 ? (totalGain / bookValue) * 100 : 0;

  // Combine holdings of the same ticker across accounts (e.g. VFV in both
  // TFSA and FHSA) so each symbol appears once in the list and pie.
  const bySymbol = new Map<string, number>();
  for (const h of holdings) {
    bySymbol.set(
      h.symbol,
      (bySymbol.get(h.symbol) ?? 0) + Number(h.market_value ?? 0)
    );
  }
  const top = [...bySymbol.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const otherValue = totalValue - top.reduce((s, [, v]) => s + v, 0);
  const allocation = [
    ...top.map(([name, value]) => ({ name, value })),
    ...(otherValue > 0.01 ? [{ name: "Other", value: otherValue }] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href="/investments" className="hover:underline">
            Investments
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <WidgetEmpty
            message="No holdings yet."
            actionLabel="Import from Wealthsimple"
            actionHref="/investments"
          />
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-numeric text-2xl font-semibold">
                {formatCAD(totalValue)}
              </p>
              <p
                className={cn(
                  "text-numeric mt-1 text-sm font-medium",
                  totalGain >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {formatCADSigned(totalGain)} ({formatPercentSigned(gainPct)})
              </p>
              <ul className="mt-3 space-y-1">
                {allocation.map((a, i) => (
                  <li
                    key={a.name}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                      aria-hidden
                    />
                    {a.name}
                    <span className="text-numeric ml-auto">
                      {totalValue > 0
                        ? Math.round((a.value / totalValue) * 100)
                        : 0}
                      %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {allocation.map((a, i) => (
                      <Cell key={a.name} fill={COLORS[i % COLORS.length]} />
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
