"use client";

import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { daysUntilDayOfMonth } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Account, PaymentReminder } from "@/types";

/**
 * Pay 2 days before the statement closes so the reported balance (what the
 * credit bureau sees) is low — the master-plan rule for utilization control.
 */
const PAY_BUFFER_DAYS = 2;

function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

export function PaymentSchedule({
  cards,
  reminders,
  onSetSchedule,
}: {
  cards: Account[];
  reminders: PaymentReminder[];
  onSetSchedule: (card: Account) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cards.map((card) => {
          const reminder = reminders.find((r) => r.account_id === card.id);
          if (!reminder?.statement_close_date || !reminder.due_date) {
            return (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2.5"
              >
                <span className="text-sm font-medium">{card.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetSchedule(card)}
                >
                  Set schedule
                </Button>
              </div>
            );
          }

          const closeDay = reminder.statement_close_date;
          const dueDay = reminder.due_date;
          const daysToClose = daysUntilDayOfMonth(closeDay);
          const daysToPay = daysToClose - PAY_BUFFER_DAYS;
          const hasBalance = Number(card.balance) > 0;

          return (
            <div key={card.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: card.color }}
                    aria-hidden
                  />
                  {card.name}
                </span>
                {reminder.autopay_enabled ? (
                  <Badge variant="outline" className="gap-1 text-success">
                    <CheckCircle2 className="size-3" aria-hidden />
                    Autopay
                    {reminder.autopay_type === "full_balance"
                      ? " · full"
                      : reminder.autopay_type === "minimum"
                        ? " · min"
                        : ""}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 text-muted-foreground"
                  >
                    <XCircle className="size-3" aria-hidden />
                    No autopay
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <TimelineStep
                  label={`Pay by ${ordinal(Math.max(closeDay - PAY_BUFFER_DAYS, 1))}`}
                  value={
                    daysToPay <= 0 && hasBalance
                      ? "Pay now"
                      : `${Math.max(daysToPay, 0)}d`
                  }
                  className={cn(
                    hasBalance && daysToPay <= 0 && "text-destructive",
                    hasBalance &&
                      daysToPay > 0 &&
                      daysToPay <= 3 &&
                      "text-warning"
                  )}
                />
                <TimelineStep
                  label={`Closes ${ordinal(closeDay)}`}
                  value={`${daysToClose}d`}
                />
                <TimelineStep
                  label={`Due ${ordinal(dueDay)}`}
                  value={`${daysUntilDayOfMonth(dueDay)}d`}
                />
              </div>
            </div>
          );
        })}

        <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Pay {PAY_BUFFER_DAYS} days before the statement closes so a low
          balance is reported to the credit bureau.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineStep({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-numeric font-medium", className)}>{value}</p>
    </div>
  );
}
