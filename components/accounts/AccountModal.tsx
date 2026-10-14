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
import { useUpsertAccount } from "@/lib/hooks/useAccounts";
import type { Account, AccountType } from "@/types";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "chequing", label: "Chequing" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit card" },
  { value: "tfsa", label: "TFSA" },
  { value: "fhsa", label: "FHSA" },
  { value: "investment", label: "Investment" },
  { value: "crypto", label: "Crypto" },
];

const schema = z.object({
  name: z.string().min(1, "Required"),
  type: z.enum([
    "chequing",
    "savings",
    "credit_card",
    "tfsa",
    "fhsa",
    "investment",
    "crypto",
  ]),
  institution: z.string().min(1, "Required"),
  balance: z.number({ message: "Enter a balance" }),
  credit_limit: z.number().positive().nullable(),
  // Optional: blank or exactly 4 digits. Mapped to null on save.
  account_number_last4: z
    .string()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "4 digits"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  type: "chequing",
  institution: "",
  balance: 0,
  credit_limit: null,
  account_number_last4: "",
};

export function AccountModal({
  open,
  onOpenChange,
  editing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Account | null;
  /** Called with the new account after a successful create (not on edit). */
  onCreated?: (account: Account) => void;
}) {
  const upsertAccount = useUpsertAccount();

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
              type: editing.type,
              institution: editing.institution,
              balance: Number(editing.balance),
              credit_limit:
                editing.credit_limit === null
                  ? null
                  : Number(editing.credit_limit),
              account_number_last4: editing.account_number_last4 ?? "",
            }
          : EMPTY
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const type = form.watch("type");

  async function onSubmit(values: FormValues) {
    const account = await upsertAccount.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      name: values.name,
      type: values.type,
      institution: values.institution,
      balance: values.balance,
      credit_limit: values.type === "credit_card" ? values.credit_limit : null,
      account_number_last4: values.account_number_last4 || null,
    });
    onOpenChange(false);
    if (!editing) onCreated?.(account);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "Add account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                placeholder="RBC Chequing"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  form.setValue("type", v as FormValues["type"])
                }
              >
                <SelectTrigger id="account-type" aria-label="Account type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="account-institution">Institution</Label>
              <Input
                id="account-institution"
                placeholder="RBC"
                {...form.register("institution")}
              />
              <FieldError
                message={form.formState.errors.institution?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-balance">Current balance</Label>
              <Input
                id="account-balance"
                type="number"
                step="any"
                {...form.register("balance", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.balance?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {type === "credit_card" && (
              <div className="space-y-2">
                <Label htmlFor="account-limit">Credit limit</Label>
                <Input
                  id="account-limit"
                  type="number"
                  step="any"
                  {...form.register("credit_limit", {
                    setValueAs: (v) =>
                      v === "" || v === null ? null : Number(v),
                  })}
                />
                <FieldError
                  message={form.formState.errors.credit_limit?.message}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="account-last4">Last 4 digits (optional)</Label>
              <Input
                id="account-last4"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                {...form.register("account_number_last4")}
              />
              <FieldError
                message={form.formState.errors.account_number_last4?.message}
              />
            </div>
          </div>

          {type === "credit_card" && (
            <p className="text-xs text-muted-foreground">
              Tip: adding the card on the Credit Cards page also sets up
              statement and due-date reminders.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={upsertAccount.isPending}
          >
            {editing ? "Save changes" : "Add account"}
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
