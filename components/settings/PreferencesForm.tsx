"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useUpdateUserSettings } from "@/lib/hooks/useSettings";
import type { Account, UserSettings } from "@/types";

const NONE = "none";

const schema = z.object({
  avion_points_balance: z
    .number({ message: "Enter a number" })
    .int("Whole number")
    .min(0, "Can't be negative"),
  dry_powder_amount: z
    .number({ message: "Enter an amount" })
    .min(0, "Can't be negative"),
  dry_powder_account_id: z.string(),
});

type FormValues = z.infer<typeof schema>;

function toFormValues(settings: UserSettings | null): FormValues {
  return {
    avion_points_balance: Number(settings?.avion_points_balance ?? 0),
    dry_powder_amount: Number(settings?.dry_powder_amount ?? 0),
    dry_powder_account_id: settings?.dry_powder_account_id ?? NONE,
  };
}

export function PreferencesForm({
  settings,
  accounts,
}: {
  settings: UserSettings | null;
  accounts: Account[];
}) {
  const updateSettings = useUpdateUserSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(settings),
  });

  useEffect(() => {
    form.reset(toFormValues(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function onSubmit(values: FormValues) {
    updateSettings.mutate({
      avion_points_balance: values.avion_points_balance,
      dry_powder_amount: values.dry_powder_amount,
      dry_powder_account_id:
        values.dry_powder_account_id === NONE
          ? null
          : values.dry_powder_account_id,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial preferences</CardTitle>
        <CardDescription>
          Avion points and cash you keep ready to invest
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pref-avion">Avion points balance</Label>
            <Input
              id="pref-avion"
              type="number"
              min={0}
              step={1}
              {...form.register("avion_points_balance", {
                valueAsNumber: true,
              })}
            />
            <FieldError
              message={form.formState.errors.avion_points_balance?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pref-dry-powder">Dry powder amount</Label>
            <Input
              id="pref-dry-powder"
              type="number"
              min={0}
              step="any"
              {...form.register("dry_powder_amount", { valueAsNumber: true })}
            />
            <FieldError
              message={form.formState.errors.dry_powder_amount?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pref-dry-powder-account">Dry powder account</Label>
            <Select
              value={form.watch("dry_powder_account_id")}
              onValueChange={(v) =>
                form.setValue("dry_powder_account_id", v, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="pref-dry-powder-account" className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.institution})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Where your investable cash sits while waiting to be deployed.
            </p>
          </div>

          <Button
            type="submit"
            disabled={updateSettings.isPending || !form.formState.isDirty}
          >
            {updateSettings.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
