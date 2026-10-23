"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertGoal } from "@/lib/hooks/useGoals";
import { formatCAD } from "@/lib/utils/currency";
import type { Account, Goal } from "@/types";

const MANUAL = "manual";
/** Accounts that can hold savings (not credit cards). */
const SAVINGS_TYPES = new Set(["savings", "chequing", "tfsa", "fhsa", "investment"]);

const schema = z.object({
  emoji: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  target_amount: z.number({ message: "Enter an amount" }).positive(),
  target_date: z.string(),
  source: z.string(),
  saved_amount: z.number({ message: "Enter an amount" }).min(0),
});

type FormValues = z.infer<typeof schema>;

/** Starting values for a new goal, e.g. a suggested emergency fund. */
export type GoalDraft = Partial<Pick<Goal, "name" | "emoji" | "target_amount">>;

export function GoalModal({
  open,
  onOpenChange,
  editing,
  draft,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Goal | null;
  draft?: GoalDraft | null;
  accounts: Account[];
}) {
  const upsert = useUpsertGoal();
  const savingsAccounts = accounts.filter(
    (a) => a.is_active && SAVINGS_TYPES.has(a.type)
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            emoji: editing.emoji,
            name: editing.name,
            target_amount: Number(editing.target_amount),
            target_date: editing.target_date ?? "",
            source: editing.account_id ?? MANUAL,
            saved_amount: Number(editing.saved_amount),
          }
        : {
            emoji: draft?.emoji ?? "🎯",
            name: draft?.name ?? "",
            target_amount: draft?.target_amount ?? (undefined as unknown as number),
            target_date: "",
            source: MANUAL,
            saved_amount: 0,
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, draft]);

  const source = form.watch("source");

  function onSubmit(values: FormValues) {
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        emoji: values.emoji,
        name: values.name,
        target_amount: values.target_amount,
        target_date: values.target_date || null,
        account_id: values.source === MANUAL ? null : values.source,
        saved_amount: values.source === MANUAL ? values.saved_amount : 0,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[4rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-emoji">Emoji</Label>
              <Input id="goal-emoji" className="text-center" {...form.register("emoji")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-name">Name</Label>
              <Input id="goal-name" placeholder="Emergency fund" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                type="number"
                step="any"
                min={0}
                {...form.register("target_amount", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.target_amount?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-date">By (optional)</Label>
              <Input id="goal-date" type="date" {...form.register("target_date")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Track progress with</Label>
            <Select
              value={source}
              onValueChange={(v) => form.setValue("source", v)}
            >
              <SelectTrigger aria-label="Track progress with" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>Amounts I enter</SelectItem>
                {savingsAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} balance ({formatCAD(Number(a.balance))})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Linking an account counts its whole balance toward this goal.
            </p>
          </div>

          {source === MANUAL && (
            <div className="space-y-2">
              <Label htmlFor="goal-saved">Saved so far</Label>
              <Input
                id="goal-saved"
                type="number"
                step="any"
                min={0}
                {...form.register("saved_amount", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.saved_amount?.message} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            {editing ? "Save changes" : "Create goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
