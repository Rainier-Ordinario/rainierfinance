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
import { useUpsertInvestment } from "@/lib/hooks/useInvestments";
import type { AssetType, Investment, RegisteredAccountType } from "@/types";

const schema = z.object({
  symbol: z.string().min(1, "Required").toUpperCase(),
  name: z.string().min(1, "Required"),
  quantity: z.number({ message: "Enter quantity" }).positive(),
  average_cost: z.number({ message: "Enter average cost" }).positive(),
  current_price: z
    .number({ message: "Enter a price" })
    .positive()
    .nullable(),
  account_type: z.enum(["TFSA", "FHSA", "RRSP", "Non-Registered"]),
  asset_type: z.enum(["ETF", "EQUITY", "CRYPTO"]),
});

type FormValues = z.infer<typeof schema>;

export function InvestmentModal({
  open,
  onOpenChange,
  editing,
  defaultAccountType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Investment | null;
  defaultAccountType?: RegisteredAccountType;
}) {
  const upsert = useUpsertInvestment();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symbol: "",
      name: "",
      quantity: 0,
      average_cost: 0,
      current_price: null,
      account_type: defaultAccountType ?? "TFSA",
      asset_type: "ETF",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              symbol: editing.symbol,
              name: editing.name,
              quantity: Number(editing.quantity),
              average_cost: Number(editing.average_cost),
              current_price:
                editing.current_price !== null
                  ? Number(editing.current_price)
                  : null,
              account_type: editing.account_type ?? "TFSA",
              asset_type: editing.asset_type ?? "ETF",
            }
          : {
              symbol: "",
              name: "",
              quantity: 0,
              average_cost: 0,
              current_price: null,
              account_type: defaultAccountType ?? "TFSA",
              asset_type: "ETF",
            }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, defaultAccountType]);

  function onSubmit(values: FormValues) {
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        ...values,
        account_type: values.account_type as RegisteredAccountType,
        asset_type: values.asset_type as AssetType,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit holding" : "Add holding"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-symbol">Symbol</Label>
              <Input id="inv-symbol" placeholder="VFV" {...form.register("symbol")} />
              <FieldError message={form.formState.errors.symbol?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                placeholder="Vanguard S&P 500 ETF"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-qty">Quantity</Label>
              <Input
                id="inv-qty"
                type="number"
                step="any"
                {...form.register("quantity", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.quantity?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-cost">Avg cost</Label>
              <Input
                id="inv-cost"
                type="number"
                step="any"
                {...form.register("average_cost", { valueAsNumber: true })}
              />
              <FieldError
                message={form.formState.errors.average_cost?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-price">Price</Label>
              <Input
                id="inv-price"
                type="number"
                step="any"
                {...form.register("current_price", {
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={form.watch("account_type")}
                onValueChange={(v) =>
                  form.setValue("account_type", v as FormValues["account_type"])
                }
              >
                <SelectTrigger aria-label="Account type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["TFSA", "FHSA", "RRSP", "Non-Registered"] as const).map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asset type</Label>
              <Select
                value={form.watch("asset_type")}
                onValueChange={(v) =>
                  form.setValue("asset_type", v as FormValues["asset_type"])
                }
              >
                <SelectTrigger aria-label="Asset type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            {editing ? "Save changes" : "Add holding"}
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
