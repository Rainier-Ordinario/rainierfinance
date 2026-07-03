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
import { useUpsertBudget } from "@/lib/hooks/useBudgets";
import { useCategories } from "@/lib/hooks/useCategories";
import { toISODate } from "@/lib/utils/dates";
import type { Budget, BudgetPeriod } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Required"),
  emoji: z.string().min(1, "Required"),
  total_amount: z.number({ message: "Enter an amount" }).positive(),
  period: z.enum(["monthly", "weekly", "yearly"]),
  category: z.string().min(1, "Required"),
  color: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  emoji: "💰",
  total_amount: 0,
  period: "monthly",
  category: "",
  color: "#6366F1",
};

export function BudgetModal({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Budget | null;
}) {
  const upsert = useUpsertBudget();
  const categories = useCategories();
  const expenseCategories = (categories.data ?? []).filter(
    (c) => c.type !== "income"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              name: editing.name,
              emoji: editing.emoji,
              total_amount: Number(editing.total_amount),
              period:
                editing.period === "custom" || !editing.period
                  ? "monthly"
                  : editing.period,
              category: editing.category ?? "",
              color: editing.color,
            }
          : EMPTY
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function onSubmit(values: FormValues) {
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        ...values,
        period: values.period as BudgetPeriod,
        start_date: editing?.start_date ?? toISODate(new Date()),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "Add budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[4rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="budget-emoji">Emoji</Label>
              <Input
                id="budget-emoji"
                className="text-center"
                {...form.register("emoji")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-name">Name</Label>
              <Input
                id="budget-name"
                placeholder="Groceries"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Amount</Label>
              <Input
                id="budget-amount"
                type="number"
                step="any"
                {...form.register("total_amount", { valueAsNumber: true })}
              />
              <FieldError
                message={form.formState.errors.total_amount?.message}
              />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={form.watch("period")}
                onValueChange={(v) =>
                  form.setValue("period", v as FormValues["period"])
                }
              >
                <SelectTrigger aria-label="Period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-color">Color</Label>
              <Input
                id="budget-color"
                type="color"
                className="h-9 p-1"
                {...form.register("color")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v) => form.setValue("category", v)}
            >
              <SelectTrigger aria-label="Category" className="w-full">
                <SelectValue placeholder="Which spending counts?" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={form.formState.errors.category?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            {editing ? "Save changes" : "Add budget"}
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
