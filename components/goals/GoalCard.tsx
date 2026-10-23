"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpsertGoal } from "@/lib/hooks/useGoals";
import { formatCADWhole } from "@/lib/utils/currency";
import type { GoalProgress } from "@/lib/utils/goals";
import { cn } from "@/lib/utils";
import type { Account, Goal } from "@/types";

function AddMoney({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const upsert = useUpsertGoal();
  const value = Number(amount);
  const valid = amount.trim() !== "" && value !== 0 && !Number.isNaN(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" aria-hidden />
          Add money
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            upsert.mutate(
              {
                id: goal.id,
                name: goal.name,
                target_amount: goal.target_amount,
                saved_amount: Math.max(0, Number(goal.saved_amount) + value),
              },
              {
                onSuccess: () => {
                  setOpen(false);
                  setAmount("");
                },
              }
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`add-${goal.id}`}>Amount</Label>
            <Input
              id={`add-${goal.id}`}
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Use a negative amount to take money out.
            </p>
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={!valid || upsert.isPending}>
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function pace(progress: GoalProgress, monthlySaving: number): string {
  switch (progress.status) {
    case "done":
      return "Reached. Nice work.";
    case "no_date":
      return progress.etaMonths === null
        ? "No date set. Save something each month to get an estimate."
        : `At your recent pace (${formatCADWhole(monthlySaving)}/mo saved), about ${progress.etaMonths} ${progress.etaMonths === 1 ? "month" : "months"} to go.`;
    default:
      return `Needs ${formatCADWhole(progress.neededPerMonth ?? 0)}/mo for ${progress.monthsLeft} ${progress.monthsLeft === 1 ? "month" : "months"}; you've been saving ${formatCADWhole(monthlySaving)}/mo.`;
  }
}

export function GoalCard({
  goal,
  progress,
  monthlySaving,
  accounts,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  progress: GoalProgress;
  monthlySaving: number;
  accounts: Account[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const linked = goal.account_id
    ? accounts.find((a) => a.id === goal.account_id)
    : null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {goal.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{goal.name}</p>
              <p className="text-xs text-muted-foreground">
                {goal.target_date
                  ? `By ${format(parseISO(goal.target_date), "MMM yyyy")}`
                  : "No deadline"}
                {linked && ` · ${linked.name} balance`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={`Edit ${goal.name}`}>
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onDelete} aria-label={`Delete ${goal.name}`}>
              <Trash2 className="size-3.5 text-destructive" aria-hidden />
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-numeric font-semibold">
              {formatCADWhole(progress.current)}
            </span>
            <span className="text-muted-foreground">
              of {formatCADWhole(Number(goal.target_amount))} ·{" "}
              {Math.round(progress.pct)}%
            </span>
          </div>
          <Progress value={progress.pct} aria-label={`${goal.name} progress`} />
        </div>

        <p
          className={cn(
            "text-xs",
            progress.status === "behind"
              ? "text-warning"
              : progress.status === "done" || progress.status === "on_track"
                ? "text-success"
                : "text-muted-foreground"
          )}
        >
          {pace(progress, monthlySaving)}
        </p>

        {!goal.account_id && progress.status !== "done" && <AddMoney goal={goal} />}
      </CardContent>
    </Card>
  );
}
