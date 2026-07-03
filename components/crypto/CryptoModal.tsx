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
import { useUpsertCryptoHolding } from "@/lib/hooks/useCrypto";
import type { CryptoHolding } from "@/types";

const schema = z.object({
  symbol: z
    .string()
    .min(1, "Required")
    .max(10, "Too long")
    .regex(/^[A-Za-z0-9]+$/, "Letters/digits only"),
  name: z.string().min(1, "Required"),
  quantity: z.number({ message: "Enter a quantity" }).positive("Must be > 0"),
  average_cost_cad: z
    .number({ message: "Enter a cost" })
    .min(0, "Can't be negative"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  symbol: "",
  name: "",
  quantity: 0,
  average_cost_cad: 0,
};

export function CryptoModal({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CryptoHolding | null;
}) {
  const upsert = useUpsertCryptoHolding();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              symbol: editing.symbol,
              name: editing.name,
              quantity: Number(editing.quantity),
              average_cost_cad: Number(editing.average_cost_cad),
            }
          : EMPTY
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function onSubmit(values: FormValues) {
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      symbol: values.symbol.toUpperCase(),
      name: values.name,
      quantity: values.quantity,
      average_cost_cad: values.average_cost_cad,
      current_price_cad: editing?.current_price_cad ?? null,
    });
    onOpenChange(false);
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
              <Label htmlFor="crypto-symbol">Symbol</Label>
              <Input
                id="crypto-symbol"
                placeholder="BTC"
                className="uppercase"
                {...form.register("symbol")}
              />
              <FieldError message={form.formState.errors.symbol?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crypto-name">Name</Label>
              <Input
                id="crypto-name"
                placeholder="Bitcoin"
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="crypto-quantity">Quantity</Label>
              <Input
                id="crypto-quantity"
                type="number"
                step="any"
                {...form.register("quantity", { valueAsNumber: true })}
              />
              <FieldError message={form.formState.errors.quantity?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crypto-cost">Avg cost (CAD)</Label>
              <Input
                id="crypto-cost"
                type="number"
                step="any"
                {...form.register("average_cost_cad", { valueAsNumber: true })}
              />
              <FieldError
                message={form.formState.errors.average_cost_cad?.message}
              />
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
