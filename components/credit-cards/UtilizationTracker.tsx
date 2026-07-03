"use client";

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
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCAD, formatPercent } from "@/lib/utils/currency";
import { calculateUtilization } from "@/lib/utils/portfolio";
import type { Account, NetWorthSnapshot } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  warning: "Getting high",
  danger: "Too high",
};

export function UtilizationTracker({
  cards,
  snapshots,
}: {
  cards: Account[];
  snapshots: NetWorthSnapshot[];
}) {
  const totalBalance = cards.reduce((s, c) => s + Number(c.balance), 0);
  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit ?? 0), 0);
  const combined = calculateUtilization(totalBalance, totalLimit);
  const target = totalLimit * 0.3;

  const cardIds = new Set(cards.map((c) => c.id));
  const history = snapshots.slice(-6).map((s) => {
    const balances = s.account_balances ?? {};
    const cardBalance = Object.entries(balances)
      .filter(([id]) => cardIds.has(id))
      .reduce((sum, [, b]) => sum + Number(b), 0);
    return {
      label: format(parseISO(s.snapshot_date), "MMM"),
      balance: cardBalance,
    };
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Combined Utilization</CardTitle>
        <Badge
          variant="outline"
          style={{ color: combined.color, borderColor: combined.color }}
        >
          {STATUS_LABEL[combined.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span
            className="text-numeric text-3xl font-semibold"
            style={{ color: combined.color }}
          >
            {formatPercent(combined.percentage)}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatCAD(totalBalance)} of {formatCAD(totalLimit)} — target under{" "}
            {formatCAD(target)}
          </span>
        </div>

        {history.length >= 2 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
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
                  width={72}
                  domain={[0, (dataMax: number) => Math.max(dataMax, target) * 1.1]}
                />
                <Tooltip
                  formatter={(value) => formatCAD(Number(value))}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <ReferenceLine
                  y={target}
                  stroke="var(--warning)"
                  strokeDasharray="6 4"
                  label={{
                    value: `${formatCAD(target)} target`,
                    position: "insideTopRight",
                    fill: "var(--warning)",
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Card balance"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
            Log monthly snapshots on the Net Worth page to see utilization
            history here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
