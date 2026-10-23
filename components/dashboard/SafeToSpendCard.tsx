"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WidgetEmpty } from "@/components/shared/WidgetEmpty";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/lib/hooks/useSettings";
import { formatCADWhole } from "@/lib/utils/currency";
import {
  DEFAULT_SAVINGS_TARGET_PCT,
  safeToSpend,
} from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

function SavingsTargetEditor({ value }: { value: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const update = useUpdateUserSettings();
  const parsed = Number(draft);
  const valid = draft.trim() !== "" && parsed >= 0 && parsed <= 100;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(String(value));
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
          Saving {value}%
          <Pencil className="size-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            update.mutate(
              { savings_target_pct: parsed },
              { onSuccess: () => setOpen(false) }
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="savings-target">Savings goal (% of income)</Label>
            <Input
              id="savings-target"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!valid}
            />
            <p className="text-xs text-muted-foreground">
              Set aside before anything counts as safe to spend. 20% is a
              common starting point.
            </p>
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={!valid || update.isPending}>
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Line({
  label,
  amount,
  sign,
  strong,
}: {
  label: string;
  amount: number;
  sign?: "−" | "=";
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong && "border-t pt-1 font-medium text-foreground"
      )}
    >
      <dt>
        {sign && <span className="mr-1 inline-block w-3">{sign}</span>}
        {label}
      </dt>
      <dd className="text-numeric">{formatCADWhole(amount)}</dd>
    </div>
  );
}

/**
 * The daily number: what can go to wants today and still leave this month's
 * bills, essentials, and savings goal covered.
 */
export function SafeToSpendCard({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const settings = useUserSettings();
  const targetPct = Number(
    settings.data?.savings_target_pct ?? DEFAULT_SAVINGS_TARGET_PCT
  );
  const s = useMemo(
    () => safeToSpend(transactions, categories, targetPct),
    [transactions, categories, targetPct]
  );

  const over = s !== null && s.remaining < 0;
  const todayPct =
    s && s.dailyAllowance > 0
      ? Math.min(100, (s.spentToday / s.dailyAllowance) * 100)
      : s && s.spentToday > 0
        ? 100
        : 0;
  const overToday = s !== null && s.spentToday > s.dailyAllowance;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Safe to spend today</CardTitle>
          <CardDescription>On wants, with bills and savings covered</CardDescription>
        </div>
        <SavingsTargetEditor value={targetPct} />
      </CardHeader>
      <CardContent>
        {s === null ? (
          <WidgetEmpty
            message="A daily budget appears once your income shows up in transactions."
            actionLabel="Add or import transactions"
            actionHref="/transactions"
          />
        ) : (
          <div className="space-y-4">
            <div>
              <p
                className={cn(
                  "text-numeric text-4xl font-semibold tracking-tight",
                  over && "text-destructive"
                )}
              >
                {formatCADWhole(s.dailyAllowance)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {over ? (
                  <>
                    Wants are{" "}
                    <span className="font-medium text-destructive">
                      {formatCADWhole(-s.remaining)} over
                    </span>{" "}
                    this month — every extra dollar now comes out of your{" "}
                    {formatCADWhole(s.savingsTarget)} savings goal.
                  </>
                ) : (
                  <>
                    {formatCADWhole(s.remaining)} left for wants over the next{" "}
                    {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"}
                  </>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Spent on wants today</span>
                <span className="text-numeric">
                  <span className={cn(overToday ? "text-destructive" : "text-foreground")}>
                    {formatCADWhole(s.spentToday)}
                  </span>{" "}
                  of {formatCADWhole(s.dailyAllowance)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Spent on wants today"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(todayPct)}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    overToday ? "bg-destructive" : "bg-chart-1"
                  )}
                  style={{ width: `${todayPct}%` }}
                />
              </div>
            </div>

            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-4 group-open:underline">
                  How it&apos;s worked out
                </span>
              </summary>
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <Line label="Expected income" amount={s.expectedIncome} />
                <Line label="Fixed bills" amount={s.expectedFixed} sign="−" />
                <Line label="Essentials" amount={s.expectedEssential} sign="−" />
                <Line label={`Savings goal (${targetPct}%)`} amount={s.savingsTarget} sign="−" />
                <Line label="For wants this month" amount={s.wantsBudget} sign="=" strong />
                <Line
                  label="Already spent on wants"
                  amount={s.spentBeforeToday + s.spentToday}
                  sign="−"
                />
                <Line label="Left" amount={s.remaining} sign="=" strong />
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Income, bills, and essentials use this month so far or your
                3-month average, whichever is higher, so payments that
                haven&apos;t landed yet are still set aside.
              </p>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
