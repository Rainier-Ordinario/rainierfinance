"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, startOfMonth, startOfWeek } from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  CardSkeleton,
  StatCardSkeleton,
} from "@/components/shared/CardSkeleton";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { SpendingDonut } from "@/components/dashboard/SpendingDonut";
import {
  useMonthlyRecap,
  useWeeklyRecap,
  type PeriodRecap,
} from "@/lib/hooks/useWeeklyRecap";
import { useBudgets } from "@/lib/hooks/useBudgets";
import { useCategories } from "@/lib/hooks/useCategories";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { budgetProgress } from "@/lib/utils/budgets";
import {
  formatCAD,
  formatCADSigned,
  formatPercentSigned,
  formatTransactionAmount,
} from "@/lib/utils/currency";
import {
  formatDateShort,
  formatDayHeading,
  toISODate,
} from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

type Period = "week" | "month";

const PERIOD_CONFIG: Record<
  Period,
  {
    noun: string;
    currentBadge: string;
    backLabel: string;
    prevLabel: string;
    currentStart: () => string;
    shift: (startISO: string, steps: number) => string;
  }
> = {
  week: {
    noun: "week",
    currentBadge: "This week",
    backLabel: "Back to this week",
    prevLabel: "vs last week",
    currentStart: () => toISODate(startOfWeek(new Date(), { weekStartsOn: 1 })),
    shift: (startISO, steps) =>
      toISODate(addDays(new Date(`${startISO}T00:00:00`), steps * 7)),
  },
  month: {
    noun: "month",
    currentBadge: "This month",
    backLabel: "Back to this month",
    prevLabel: "vs last month",
    currentStart: () => toISODate(startOfMonth(new Date())),
    shift: (startISO, steps) =>
      toISODate(startOfMonth(addMonths(new Date(`${startISO}T00:00:00`), steps))),
  },
};

function DeltaLine({
  current,
  previous,
  downIsGood,
  label,
}: {
  current: number;
  previous: number;
  downIsGood: boolean;
  label: string;
}) {
  if (previous <= 0 && current <= 0) return null;
  const delta = current - previous;
  const good = downIsGood ? delta <= 0 : delta >= 0;
  return (
    <p className={cn("mt-1 text-xs", good ? "text-success" : "text-destructive")}>
      {formatCADSigned(delta)}
      {previous > 0 && (
        <span> ({formatPercentSigned((delta / previous) * 100, 0)})</span>
      )}{" "}
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

function useRecapForPeriod(period: Period, start: string) {
  const weekly = useWeeklyRecap(period === "week" ? start : "");
  const monthly = useMonthlyRecap(period === "month" ? start : "");
  return period === "week" ? weekly : monthly;
}

export function RecapView({ period }: { period: Period }) {
  const config = PERIOD_CONFIG[period];
  const [start, setStart] = useState(config.currentStart);
  const recap = useRecapForPeriod(period, start);
  const budgets = useBudgets();
  const categories = useCategories();
  const transactions = useTransactions();

  const isCurrent = start === config.currentStart();

  const budgetRows = useMemo(() => {
    if (!recap.data) return [];
    const spendByCategory = new Map(
      recap.data.categories.map((c) => [c.category, c.amount])
    );
    // Progress as of the recap period's end (clamped to today for the
    // current period), computed live from transactions like the Budgets page.
    const asOf = new Date(
      Math.min(new Date(`${recap.data.end}T12:00:00`).getTime(), Date.now())
    );
    const txs = transactions.data ?? [];
    return (budgets.data ?? [])
      .filter((b) => b.category)
      .map((b) => {
        const progress = budgetProgress(b, txs, asOf);
        return {
          budget: b,
          periodSpend: spendByCategory.get(b.category as string) ?? 0,
          spent: progress.spent,
          pct: Math.min(100, progress.pctSpent),
        };
      });
  }, [recap.data, budgets.data, transactions.data]);

  // Every transaction in the period, grouped by day in chronological order.
  // Each day carries its spending (expense) subtotal; empty days are omitted.
  const dayGroups = useMemo(() => {
    if (!recap.data) return [];
    const byDay = new Map<string, Transaction[]>();
    for (const t of recap.data.transactions) {
      byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, txs]) => ({
        date,
        txs,
        spent: txs
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
      }));
  }, [recap.data]);

  const data: PeriodRecap | undefined = recap.data;

  return (
    <div>
      {/* Period navigation */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setStart((s) => config.shift(s, -1))}
          aria-label={`Previous ${config.noun}`}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setStart((s) => config.shift(s, 1))}
          disabled={isCurrent}
          aria-label={`Next ${config.noun}`}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <span className="ml-1 text-sm font-medium">
          {data?.label ?? "…"}
          {isCurrent && (
            <Badge variant="secondary" className="ml-2">
              {config.currentBadge}
            </Badge>
          )}
        </span>
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setStart(config.currentStart())}
          >
            {config.backLabel}
          </Button>
        )}
      </div>

      {recap.isLoading || !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={5} />
          </div>
        </>
      ) : data.transactions.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={`A quiet ${config.noun}`}
          description={`No transactions recorded for this ${config.noun}.`}
        />
      ) : (
        <>
          {/* Totals */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(data.spent)}
                </p>
                <DeltaLine
                  current={data.spent}
                  previous={data.prevSpent}
                  downIsGood
                  label={config.prevLabel}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-numeric mt-1 text-2xl font-semibold text-success">
                  {formatCAD(data.income)}
                </p>
                {data.income === 0 ? (
                  // A no-payday week isn't a 100% income crash — keep it calm.
                  <p className="mt-1 text-xs text-muted-foreground">
                    No income recorded this {config.noun}
                  </p>
                ) : (
                  <DeltaLine
                    current={data.income}
                    previous={data.prevIncome}
                    downIsGood={false}
                    label={config.prevLabel}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Net worth change
                </p>
                {data.netWorthChange ? (
                  <>
                    <p
                      className={cn(
                        "text-numeric mt-1 text-2xl font-semibold",
                        (data.netWorthChange.change ?? 0) >= 0
                          ? "text-success"
                          : "text-destructive"
                      )}
                    >
                      {data.netWorthChange.change !== null
                        ? formatCADSigned(data.netWorthChange.change)
                        : formatCAD(Number(data.netWorthChange.to.net_worth))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.netWorthChange.change !== null &&
                      data.netWorthChange.from
                        ? `since ${formatDateShort(data.netWorthChange.from.snapshot_date)}`
                        : `snapshot on ${formatDateShort(data.netWorthChange.to.snapshot_date)}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No snapshot taken this {config.noun}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Category breakdown (reuses the dashboard donut) */}
            <SpendingDonut
              data={data.categories}
              categories={categories.data ?? []}
              emptyLabel={`No expenses recorded this ${config.noun}.`}
            />

            <div className="space-y-4">
              {/* Budgets touched this period */}
              <Card>
                <CardHeader>
                  <CardTitle>Budget progress</CardTitle>
                </CardHeader>
                <CardContent>
                  {budgetRows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No category budgets set up.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {budgetRows.map(({ budget, periodSpend, spent, pct }) => (
                        <li key={budget.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              {budget.emoji} {budget.name}
                            </span>
                            <span className="text-numeric text-muted-foreground">
                              {formatCAD(periodSpend)} this {config.noun}
                            </span>
                          </div>
                          <Progress value={pct} className="mt-1.5 h-1.5" />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCAD(spent)} of{" "}
                            {formatCAD(Number(budget.total_amount))} (
                            {budget.period})
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Subscriptions billed */}
              <Card>
                <CardHeader>
                  <CardTitle>Subscriptions charged</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.billedSubscriptions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No subscription charges matched this {config.noun}.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data.billedSubscriptions.map(
                        ({ subscription, transaction }) => (
                          <li
                            key={subscription.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <Repeat
                                className="size-3.5 text-muted-foreground"
                                aria-hidden
                              />
                              {subscription.name}
                              <span className="text-xs text-muted-foreground">
                                {formatDateShort(transaction.date)}
                              </span>
                            </span>
                            <span className="text-numeric">
                              {formatCAD(Math.abs(Number(transaction.amount)))}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Notable transactions */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Biggest transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.topTransactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{t.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(t.date)} · {t.category}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-numeric shrink-0 pl-3",
                        t.type === "income" ? "text-success" : ""
                      )}
                    >
                      {t.type === "income"
                        ? `+${formatCAD(Number(t.amount))}`
                        : formatCAD(Math.abs(Number(t.amount)))}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Full transaction list for the period, grouped by day */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>
                All transactions this {config.noun}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {data.transactions.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {dayGroups.map((day) => (
                <div key={day.date}>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-sm font-medium">
                      {formatDayHeading(day.date)}
                    </span>
                    <span className="text-numeric text-xs text-muted-foreground">
                      {formatCAD(day.spent)} spent
                    </span>
                  </div>
                  <ul className="divide-y">
                    {day.txs.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <CategoryIcon
                          category={t.category}
                          categories={categories.data ?? []}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {t.description}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.category}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "text-numeric shrink-0",
                            t.type === "income" && "text-success",
                            t.type === "transfer" && "text-muted-foreground"
                          )}
                        >
                          {formatTransactionAmount(Number(t.amount), t.type)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
