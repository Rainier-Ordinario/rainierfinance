"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCAD, formatPercent } from "@/lib/utils/currency";
import { calculateUtilization } from "@/lib/utils/portfolio";
import type { Account } from "@/types";

export function CardVisual({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const limit = Number(account.credit_limit ?? 0);
  const balance = Number(account.balance);
  const util = calculateUtilization(balance, limit);
  const available = Math.max(0, limit - balance);

  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset =
    circumference * (1 - Math.min(util.percentage, 100) / 100);

  return (
    <Card className="overflow-hidden">
      <div
        className="h-1.5 w-full"
        style={{ background: account.color }}
        aria-hidden
      />
      <CardContent className="flex items-center justify-between pt-5">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{account.name}</p>
            <p className="text-xs text-muted-foreground">
              {account.institution}
              {account.account_number_last4 &&
                ` ···· ${account.account_number_last4}`}
            </p>
            {(onEdit || onDelete) && (
              <div className="mt-1 -ml-2 flex gap-1">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={onEdit}
                    aria-label={`Edit ${account.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                    aria-label={`Delete ${account.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Balance </span>
              <span className="text-numeric font-semibold">
                {formatCAD(balance)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Limit </span>
              <span className="text-numeric">{formatCAD(limit)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Available </span>
              <span className="text-numeric text-success">
                {formatCAD(available)}
              </span>
            </p>
          </div>
        </div>

        <div className="relative">
          <svg
            width="68"
            height="68"
            viewBox="0 0 68 68"
            role="img"
            aria-label={`${account.name} utilization ${formatPercent(util.percentage)}`}
          >
            <circle
              cx="34"
              cy="34"
              r={r}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="6"
            />
            <circle
              cx="34"
              cy="34"
              r={r}
              fill="none"
              stroke={util.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 34 34)"
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <span className="text-numeric absolute inset-0 flex items-center justify-center text-sm font-semibold">
            {Math.round(util.percentage)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
