"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatCAD, formatPercent } from "@/lib/utils/currency";
import type { MonthCashFlow } from "@/lib/utils/aggregate";
import { cn } from "@/lib/utils";

function HistoryLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className="group block">
      <Card className="transition-all group-hover:-translate-y-0.5 group-hover:ring-primary/40">
        {children}
      </Card>
    </Link>
  );
}

function ViewHistoryHint({ label }: { label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
      {label}
      <ArrowRight
        className="size-3 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </p>
  );
}

export function MonthlySpendingCard({
  amount,
  history,
}: {
  amount: number;
  history: MonthCashFlow[];
}) {
  return (
    <HistoryLink
      href="/transactions?type=expense"
      ariaLabel="Monthly spending — view spending history"
    >
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">
          Monthly Spending
        </p>
        <p className="text-numeric mt-1 text-3xl font-semibold">
          {formatCAD(amount)}
        </p>
        <div className="mt-2 h-8" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ViewHistoryHint label="View spending history" />
      </CardContent>
    </HistoryLink>
  );
}

export function MonthlyIncomeCard({
  amount,
  history,
}: {
  amount: number;
  history: MonthCashFlow[];
}) {
  return (
    <HistoryLink
      href="/transactions?type=income"
      ariaLabel="Monthly income — view income history"
    >
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">
          Monthly Income
        </p>
        <p className="text-numeric mt-1 text-3xl font-semibold text-success">
          {formatCAD(amount)}
        </p>
        <div className="mt-2 h-8" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="income"
                stroke="var(--success)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ViewHistoryHint label="View income history" />
      </CardContent>
    </HistoryLink>
  );
}

export function SavingsRateCard({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  const good = rate >= 20;

  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Savings Rate
          </p>
          <p
            className={cn(
              "text-numeric mt-1 text-3xl font-semibold",
              rate < 0 && "text-destructive"
            )}
          >
            {formatPercent(rate, 0)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            of income kept this month
          </p>
        </div>
        <svg
          width="76"
          height="76"
          viewBox="0 0 76 76"
          role="img"
          aria-label={`Savings rate ${formatPercent(rate, 0)}`}
        >
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="7"
          />
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={good ? "var(--success)" : "var(--warning)"}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 38 38)"
          />
        </svg>
      </CardContent>
    </Card>
  );
}
