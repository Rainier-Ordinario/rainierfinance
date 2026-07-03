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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertAccount } from "@/lib/hooks/useAccounts";
import { useUpsertPaymentReminder } from "@/lib/hooks/useSettings";
import type { Account, AutopayType, PaymentReminder } from "@/types";

const dayField = z
  .number({ message: "Enter a day" })
  .int()
  .min(1, "1–28")
  .max(28, "1–28")
  .nullable();

const schema = z.object({
  name: z.string().min(1, "Required"),
  institution: z.string().min(1, "Required"),
  account_number_last4: z
    .string()
    .regex(/^\d{4}$/, "4 digits")
    .nullable(),
  credit_limit: z.number({ message: "Enter a limit" }).positive(),
  balance: z.number({ message: "Enter a balance" }).min(0),
  color: z.string().min(1),
  statement_close_date: dayField,
  due_date: dayField,
  autopay_enabled: z.boolean(),
  autopay_type: z.enum(["minimum", "full_balance", "fixed"]),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  institution: "RBC",
  account_number_last4: null,
  credit_limit: 0,
  balance: 0,
  color: "#6366F1",
  statement_close_date: 15,
  due_date: 25,
  autopay_enabled: false,
  autopay_type: "full_balance",
};

export function CardModal({
  open,
  onOpenChange,
  editing,
  reminder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Account | null;
  reminder?: PaymentReminder | null;
}) {
  const upsertAccount = useUpsertAccount();
  const upsertReminder = useUpsertPaymentReminder();

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
              institution: editing.institution,
              account_number_last4: editing.account_number_last4,
              credit_limit: Number(editing.credit_limit ?? 0),
              balance: Number(editing.balance),
              color: editing.color,
              statement_close_date: reminder?.statement_close_date ?? 15,
              due_date: reminder?.due_date ?? 25,
              autopay_enabled: reminder?.autopay_enabled ?? false,
              autopay_type: reminder?.autopay_type ?? "full_balance",
            }
          : EMPTY
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, reminder]);

  async function onSubmit(values: FormValues) {
    const account = await upsertAccount.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      name: values.name,
      type: "credit_card",
      institution: values.institution,
      account_number_last4: values.account_number_last4,
      credit_limit: values.credit_limit,
      balance: values.balance,
      color: values.color,
    });
    await upsertReminder.mutateAsync({
      ...(reminder ? { id: reminder.id } : {}),
      account_id: account.id,
      statement_close_date: values.statement_close_date,
      due_date: values.due_date,
      autopay_enabled: values.autopay_enabled,
      autopay_type: values.autopay_type as AutopayType,
    });
    onOpenChange(false);
  }

  const pending = upsertAccount.isPending || upsertReminder.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit card" : "Add card"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="card-name">Card name</Label>
              <Input
                id="card-name"
                placeholder="RBC ION+"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-institution">Institution</Label>
              <Input id="card-institution" {...form.register("institution")} />
              <FieldError
                message={form.formState.errors.institution?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="card-limit">Credit limit</Label>
              <Input
                id="card-limit"
                type="number"
                step="any"
                {...form.register("credit_limit", { valueAsNumber: true })}
              />
              <FieldError
                message={form.formState.errors.credit_limit?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-balance">Balance</Label>
              <Input
                id="card-balance"
                type="number"
                step="any"
                {...form.register("balance", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.balance?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-last4">Last 4</Label>
              <Input
                id="card-last4"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                {...form.register("account_number_last4", {
                  setValueAs: (v) => (v === "" ? null : String(v)),
                })}
              />
              <FieldError
                message={form.formState.errors.account_number_last4?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="card-close">Statement day</Label>
              <Input
                id="card-close"
                type="number"
                min={1}
                max={28}
                {...form.register("statement_close_date", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <FieldError
                message={form.formState.errors.statement_close_date?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-due">Due day</Label>
              <Input
                id="card-due"
                type="number"
                min={1}
                max={28}
                {...form.register("due_date", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <FieldError message={form.formState.errors.due_date?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-color">Color</Label>
              <Input
                id="card-color"
                type="color"
                className="h-9 p-1"
                {...form.register("color")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Switch
                id="card-autopay"
                checked={form.watch("autopay_enabled")}
                onCheckedChange={(v) => form.setValue("autopay_enabled", v)}
              />
              <Label htmlFor="card-autopay">Autopay</Label>
            </div>
            {form.watch("autopay_enabled") && (
              <Select
                value={form.watch("autopay_type")}
                onValueChange={(v) =>
                  form.setValue("autopay_type", v as FormValues["autopay_type"])
                }
              >
                <SelectTrigger
                  aria-label="Autopay type"
                  className="w-40"
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_balance">Full balance</SelectItem>
                  <SelectItem value="minimum">Minimum</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {editing ? "Save changes" : "Add card"}
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
