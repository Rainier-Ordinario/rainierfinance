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
import { useUpsertSubscription } from "@/lib/hooks/useSubscriptions";
import { useCategories } from "@/lib/hooks/useCategories";
import { toISODate } from "@/lib/utils/dates";
import type { Account, BillingCycle, Subscription, SubscriptionStatus } from "@/types";

const NONE = "__none__";

const schema = z.object({
  name: z.string().min(1, "Required"),
  amount: z.number({ message: "Enter an amount" }).positive(),
  billing_cycle: z.enum(["monthly", "yearly", "weekly"]),
  next_billing_date: z.string().min(1, "Required"),
  category: z.string(),
  account_id: z.string(),
  status: z.enum(["active", "paused", "cancelled"]),
});

type FormValues = z.infer<typeof schema>;

function empty(): FormValues {
  return {
    name: "",
    amount: 0,
    billing_cycle: "monthly",
    next_billing_date: toISODate(new Date()),
    category: "Subscriptions",
    account_id: NONE,
    status: "active",
  };
}

export function SubscriptionModal({
  open,
  onOpenChange,
  editing,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Subscription | null;
  accounts: Account[];
}) {
  const upsert = useUpsertSubscription();
  const categories = useCategories();
  const expenseCategories = (categories.data ?? []).filter(
    (c) => c.type !== "income"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              name: editing.name,
              amount: Number(editing.amount),
              billing_cycle: editing.billing_cycle ?? "monthly",
              next_billing_date: editing.next_billing_date,
              category: editing.category ?? "Subscriptions",
              account_id: editing.account_id ?? NONE,
              status: editing.status,
            }
          : empty()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function onSubmit(values: FormValues) {
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: values.name,
        amount: values.amount,
        billing_cycle: values.billing_cycle as BillingCycle,
        next_billing_date: values.next_billing_date,
        category: values.category,
        account_id: values.account_id === NONE ? null : values.account_id,
        status: values.status as SubscriptionStatus,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit subscription" : "Add subscription"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Name</Label>
              <Input id="sub-name" placeholder="Netflix" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-amount">Amount</Label>
              <Input
                id="sub-amount"
                type="number"
                step="any"
                {...form.register("amount", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.amount?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Billing cycle</Label>
              <Select
                value={form.watch("billing_cycle")}
                onValueChange={(v) =>
                  form.setValue("billing_cycle", v as FormValues["billing_cycle"])
                }
              >
                <SelectTrigger aria-label="Billing cycle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-next">Next billing</Label>
              <Input
                id="sub-next"
                type="date"
                {...form.register("next_billing_date")}
              />
              <FieldError
                message={form.formState.errors.next_billing_date?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger aria-label="Category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paid with</Label>
              <Select
                value={form.watch("account_id")}
                onValueChange={(v) => form.setValue("account_id", v)}
              >
                <SelectTrigger aria-label="Payment account" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not linked</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as FormValues["status"])
              }
            >
              <SelectTrigger aria-label="Status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            {editing ? "Save changes" : "Add subscription"}
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
