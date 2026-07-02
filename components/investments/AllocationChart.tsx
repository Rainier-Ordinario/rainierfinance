"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { formatCAD } from "@/lib/utils/currency";
import { geographicBreakdown } from "@/lib/utils/portfolio";
import type { Investment } from "@/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#64748b",
  "#f97316",
  "#94a3b8",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
} as const;

function DonutCard({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCAD(Number(value))}
                contentStyle={tooltipStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-1">
          {data.map((d, i) => (
            <li
              key={d.name}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
                aria-hidden
              />
              <span className="truncate">{d.name}</span>
              <span className="text-numeric ml-auto">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AllocationBySymbol({ holdings }: { holdings: Investment[] }) {
  const sorted = [...holdings].sort(
    (a, b) => Number(b.market_value ?? 0) - Number(a.market_value ?? 0)
  );
  const top = sorted.slice(0, 8);
  const other = sorted
    .slice(8)
    .reduce((s, h) => s + Number(h.market_value ?? 0), 0);
  const data = [
    ...top.map((h) => ({ name: h.symbol, value: Number(h.market_value ?? 0) })),
    ...(other > 0.01 ? [{ name: "Other", value: other }] : []),
  ];
  return <DonutCard title="Allocation" data={data} />;
}

export function GeographicExposure({ holdings }: { holdings: Investment[] }) {
  const geo = geographicBreakdown(holdings);
  const data = Object.entries(geo)
    .filter(([, v]) => v > 0.01)
    .map(([name, value]) => ({ name, value }));
  return <DonutCard title="Geographic Exposure" data={data} />;
}

export function EtfVsEquity({ holdings }: { holdings: Investment[] }) {
  const buckets = new Map<string, number>();
  for (const h of holdings) {
    const key = h.asset_type ?? "Other";
    buckets.set(key, (buckets.get(key) ?? 0) + Number(h.market_value ?? 0));
  }
  const data = [...buckets.entries()].map(([name, value]) => ({ name, value }));
  return <DonutCard title="ETF vs Equity" data={data} />;
}

export function PerformanceChart({ holdings }: { holdings: Investment[] }) {
  const data = [...holdings]
    .filter((h) => h.unrealized_gain_pct !== null)
    .sort(
      (a, b) => Number(b.unrealized_gain_pct) - Number(a.unrealized_gain_pct)
    )
    .map((h) => ({
      symbol: h.symbol,
      returnPct: Number(h.unrealized_gain_pct),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unrealized Return by Holding</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: Math.max(160, data.length * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                width={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}%`}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="returnPct" name="Return" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                {data.map((d) => (
                  <Cell
                    key={d.symbol}
                    fill={d.returnPct >= 0 ? "var(--chart-2)" : "var(--destructive)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
