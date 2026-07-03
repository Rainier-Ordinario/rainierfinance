"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCAD } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/dates";
import {
  budgetProgress,
  budgetTransactions,
  dailySpendSeries,
} from "@/lib/utils/budgets";
import { cn } from "@/lib/utils";
import type { Budget, Transaction } from "@/types";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
};

export function BudgetDetail({
  budget,
  transactions,
  onOpenChange,
}: {
  budget: Budget | null;
  transactions: Transaction[];
  onOpenChange: (open: boolean) => void;
}) {
  if (!budget) return null;

  const progress = budgetProgress(budget, transactions);
  const series = dailySpendSeries(budget, transactions);
  const recent = budgetTransactions(budget, transactions)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const overProjection = progress.projected > Number(budget.total_amount);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span aria-hidden>{budget.emoji}</span> {budget.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="text-numeric font-medium">
              {formatCAD(progress.spent)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {progress.remaining >= 0 ? "Remaining" : "Over"}
            </p>
            <p
              className={cn(
                "text-numeric font-medium",
                progress.remaining < 0 && "text-destructive"
              )}
            >
              {formatCAD(Math.abs(progress.remaining))}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Projected</p>
            <p
              className={cn(
                "text-numeric font-medium",
                overProjection ? "text-warning" : "text-success"
              )}
            >
              {formatCAD(progress.projected)}
            </p>
          </div>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
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
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(v) => formatCAD(Number(v))}
                width={64}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCAD(Number(value)),
                  name === "cumulative" ? "Spent" : "Even pace",
                ]}
                labelFormatter={(label) => `Day ${label}`}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="var(--muted-foreground)"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={budget.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Recent transactions</p>
          {recent.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-sm text-muted-foreground">
              Nothing spent in this period yet.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">
                      {formatDateShort(t.date)}
                    </span>{" "}
                    {t.description}
                  </span>
                  <span className="text-numeric ml-3 shrink-0">
                    {formatCAD(Math.abs(Number(t.amount)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
