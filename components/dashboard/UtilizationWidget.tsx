"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCAD, formatPercent } from "@/lib/utils/currency";
import { calculateUtilization } from "@/lib/utils/portfolio";
import { daysUntilDayOfMonth } from "@/lib/utils/dates";
import type { Account, PaymentReminder } from "@/types";

export function UtilizationWidget({
  cards,
  reminders,
}: {
  cards: Account[];
  reminders: PaymentReminder[];
}) {
  const withLimit = cards.filter((c) => Number(c.credit_limit ?? 0) > 0);
  const totalBalance = withLimit.reduce((s, c) => s + Number(c.balance), 0);
  const totalLimit = withLimit.reduce(
    (s, c) => s + Number(c.credit_limit ?? 0),
    0
  );
  const combined = calculateUtilization(totalBalance, totalLimit);

  const reminder = reminders[0];
  const closeDay = reminder?.statement_close_date ?? 15;
  const dueDay = reminder?.due_date ?? 25;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Utilization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No credit cards added yet.
          </p>
        ) : (
          <>
            {cards.map((card) => {
              const limit = Number(card.credit_limit ?? 0);
              const util = calculateUtilization(Number(card.balance), limit);
              const cardReminder = reminders.find(
                (r) => r.account_id === card.id
              );
              return (
                <div key={card.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {card.name}
                      {cardReminder?.autopay_enabled ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-success"
                        >
                          <CheckCircle2 className="size-3" aria-hidden />
                          Autopay
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
                    </span>
                    {limit > 0 && (
                      <span className="text-numeric text-muted-foreground">
                        {formatCAD(Number(card.balance))} / {formatCAD(limit)}
                      </span>
                    )}
                  </div>
                  {limit > 0 ? (
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(util.percentage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${card.name} utilization ${formatPercent(util.percentage)}`}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(util.percentage, 100)}%`,
                          background: util.color,
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No credit limit set —{" "}
                      <Link
                        href="/credit-cards"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        set it up
                      </Link>
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Combined</span>
              {totalLimit > 0 ? (
                <span
                  className="text-numeric font-semibold"
                  style={{ color: combined.color }}
                >
                  {formatPercent(combined.percentage)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  set card limits to track
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <CalendarClock
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Statement (day {closeDay})
                  </p>
                  <p className="text-numeric font-medium">
                    {daysUntilDayOfMonth(closeDay)}d
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <CalendarClock
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Due (day {dueDay})
                  </p>
                  <p className="text-numeric font-medium">
                    {daysUntilDayOfMonth(dueDay)}d
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
