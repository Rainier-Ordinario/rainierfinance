"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Minus, Plus, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertTransaction } from "@/lib/hooks/useTransactions";
import { useLearnMerchantCategory } from "@/lib/hooks/useMerchantRules";
import { AccountModal } from "@/components/accounts/AccountModal";
import { toISODate } from "@/lib/utils/dates";
import type { Account, Category, Transaction } from "@/types";

const schema = z.object({
  amount: z
    .number({ message: "Enter an amount" })
    .positive("Enter an amount above zero"),
  kind: z.enum(["expense", "income", "refund"]),
  description: z.string().min(1, "Required"),
  category: z.string().min(1, "Pick a category"),
  account_id: z.string().min(1, "Pick an account"),
  date: z.string().min(1, "Required"),
  is_recurring: z.boolean(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function TransactionModal({
  open,
  onOpenChange,
  accounts,
  categories,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  editing?: Transaction | null;
}) {
  const upsert = useUpsertTransaction();
  const learn = useLearnMerchantCategory();
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined as unknown as number,
      kind: "expense",
      description: "",
      category: "",
      account_id: "",
      date: toISODate(new Date()),
      is_recurring: false,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              amount: Math.abs(Number(editing.amount)),
              // Expenses are stored negative; a positive expense is a refund.
              kind:
                editing.type === "income"
                  ? "income"
                  : Number(editing.amount) > 0
                    ? "refund"
                    : "expense",
              description: editing.description,
              category: editing.category,
              account_id: editing.account_id,
              date: editing.date,
              is_recurring: editing.is_recurring,
              notes: editing.notes ?? "",
            }
          : {
              amount: undefined as unknown as number,
              kind: "expense",
              description: "",
              category: "",
              account_id: accounts[0]?.id ?? "",
              date: toISODate(new Date()),
              is_recurring: false,
              notes: "",
            }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const kind = form.watch("kind");
  // Refunds are money back on spending, so they take spending categories.
  const isExpense = kind !== "income";

  // "Transfer" isn't addable here, and "Income" only makes sense in income
  // mode.
  const visibleCategories = categories.filter(
    (c) => c.name !== "Transfer" && (!isExpense || c.name !== "Income")
  );

  function setMode(next: FormValues["kind"]) {
    form.setValue("kind", next);
    const category = form.getValues("category");
    if (next === "income" && !category) {
      const income = categories.find((c) => c.name === "Income");
      if (income) form.setValue("category", income.name);
    }
    if (next !== "income" && category === "Income") form.setValue("category", "");
  }


  function onSubmit(values: FormValues) {
    // Recategorizing an expense teaches the app this merchant's category.
    const recategorized =
      !!editing &&
      values.kind === "expense" &&
      editing.category !== values.category;
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        // Expenses are stored negative; income and refunds positive.
        amount: values.kind === "expense" ? -values.amount : values.amount,
        description: values.description,
        category: values.category,
        account_id: values.account_id,
        date: values.date,
        type: values.kind === "income" ? "income" : "expense",
        is_recurring: values.is_recurring,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          if (recategorized) {
            learn.mutate({
              descriptions: [values.description],
              category: values.category,
            });
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2" role="group" aria-label="Transaction kind">
            {(
              [
                { value: "expense", label: "Expense", Icon: Minus },
                { value: "income", label: "Income", Icon: Plus },
                { value: "refund", label: "Refund", Icon: Undo2 },
              ] as const
            ).map(({ value, label, Icon }) => (
              <Button
                key={value}
                type="button"
                variant={kind === value ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMode(value)}
                aria-pressed={kind === value}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Button>
            ))}
          </div>
          {kind === "refund" && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Money back from a purchase. It lowers spending in its category
              instead of counting as income.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount (CAD)</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              {...form.register("amount", { valueAsNumber: true })}
            />
            <FieldError message={form.formState.errors.amount?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-description">Description</Label>
            <Input
              id="tx-description"
              placeholder="e.g. Save-On-Foods"
              {...form.register("description")}
            />
            <FieldError message={form.formState.errors.description?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      <span
                        className="mr-1 inline-block size-2 rounded-full"
                        style={{ background: c.color }}
                        aria-hidden
                      />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.category?.message} />
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              {accounts.length === 0 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setAccountModalOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden />
                    Create account
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Transactions need an account to belong to.
                  </p>
                </>
              ) : (
                <Select
                  value={form.watch("account_id")}
                  onValueChange={(v) => form.setValue("account_id", v)}
                >
                  <SelectTrigger aria-label="Account">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FieldError message={form.formState.errors.account_id?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" {...form.register("date")} />
            <FieldError message={form.formState.errors.date?.message} />
          </div>

          <div className="rounded-lg border px-3 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx-recurring" className="cursor-pointer">
                Recurring
              </Label>
              <Switch
                id="tx-recurring"
                checked={form.watch("is_recurring")}
                onCheckedChange={(v) => form.setValue("is_recurring", v)}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Flags this charge as recurring for detection — it won&apos;t
              create a subscription.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-notes">Notes</Label>
            <Textarea id="tx-notes" rows={2} {...form.register("notes")} />
          </div>

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            {editing ? "Save changes" : "Add transaction"}
          </Button>
        </form>
      </DialogContent>

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onCreated={(account) => {
          form.setValue("account_id", account.id, { shouldValidate: true });
        }}
      />
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
