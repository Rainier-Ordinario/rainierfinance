"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCAD } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@/lib/utils/budgets";
import type { Budget } from "@/types";

const STATUS: Record<
  BudgetProgress["status"],
  { label: string; className: string }
> = {
  on_track: { label: "On track", className: "text-success" },
  watch: { label: "Trending over", className: "text-warning" },
  over: { label: "Over budget", className: "text-destructive" },
};

export function BudgetCard({
  budget,
  progress,
  onOpen,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  progress: BudgetProgress;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS[progress.status];

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/40"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${budget.name} budget details`}
    >
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden>
              {budget.emoji}
            </span>
            <div>
              <p className="text-sm font-medium">{budget.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {budget.period ?? "monthly"}
                {budget.category ? ` · ${budget.category}` : ""}
              </p>
            </div>
          </div>
          <div
            className="-mr-2 -mt-1 flex gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onEdit}
              aria-label={`Edit ${budget.name}`}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label={`Delete ${budget.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between text-sm">
          <span className="text-numeric font-semibold">
            {formatCAD(progress.spent)}
            <span className="font-normal text-muted-foreground">
              {" "}
              of {formatCAD(Number(budget.total_amount))}
            </span>
          </span>
          <Badge variant="outline" className={cn("shrink-0", status.className)}>
            {status.label}
          </Badge>
        </div>

        <div
          className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress.pctSpent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${budget.name} spent ${Math.round(progress.pctSpent)}%`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progress.pctSpent, 100)}%`,
              background: budget.color,
            }}
          />
          {/* period-elapsed pace marker */}
          <div
            className="absolute top-0 h-full w-px bg-foreground/50"
            style={{ left: `${progress.pctElapsed}%` }}
            aria-hidden
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {progress.remaining >= 0 ? (
            <>
              <span className="text-numeric">{formatCAD(progress.remaining)}</span>{" "}
              left · {progress.daysLeft}d remaining
            </>
          ) : (
            <>
              <span className="text-numeric text-destructive">
                {formatCAD(Math.abs(progress.remaining))}
              </span>{" "}
              over · {progress.daysLeft}d remaining
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
