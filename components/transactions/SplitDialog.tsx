"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSplitTransaction } from "@/lib/hooks/useTransactions";
import { formatCAD } from "@/lib/utils/currency";
import { splitError, type SplitPart } from "@/lib/utils/importDedup";
import { NOT_SPENDING } from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

/** Split one purchase (e.g. a Costco run) across categories. */
export function SplitDialog({
  transaction,
  categories,
  onOpenChange,
}: {
  transaction: Transaction | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
}) {
  const split = useSplitTransaction();
  const total = Math.abs(Number(transaction?.amount ?? 0));
  const [parts, setParts] = useState<{ category: string; amount: string }[]>([]);

  useEffect(() => {
    if (!transaction) return;
    // Start with the current category holding everything, plus an empty part.
    setParts([
      { category: transaction.category, amount: total.toFixed(2) },
      { category: "", amount: "" },
    ]);
  }, [transaction, total]);

  const spendCategories = categories.filter(
    (c) => c.type !== "income" && !NOT_SPENDING.has(c.name)
  );
  const parsed: SplitPart[] = parts.map((p) => ({
    category: p.category,
    amount: Number(p.amount),
  }));
  const error = splitError(total, parsed);
  const others = parsed.slice(1).reduce((s, p) => s + (p.amount || 0), 0);

  function update(i: number, patch: Partial<{ category: string; amount: string }>) {
    setParts((prev) => {
      const next = prev.map((p, j) => (j === i ? { ...p, ...patch } : p));
      // The first part absorbs whatever the others don't, until edited.
      if (i !== 0 && "amount" in patch) {
        const rest = next.slice(1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        next[0] = { ...next[0], amount: Math.max(0, total - rest).toFixed(2) };
      }
      return next;
    });
  }

  return (
    <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split transaction</DialogTitle>
          <DialogDescription>
            {transaction?.description} · {formatCAD(total)}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {parts.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <Select value={p.category} onValueChange={(v) => update(i, { category: v })}>
                <SelectTrigger className="flex-1" aria-label={`Part ${i + 1} category`}>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {spendCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="w-28"
                aria-label={`Part ${i + 1} amount`}
                value={p.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                disabled={parts.length <= 2}
                onClick={() => setParts((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove part ${i + 1}`}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setParts((prev) => [...prev, { category: "", amount: "" }])}
        >
          <Plus className="size-4" aria-hidden />
          Add part
        </Button>
        <p className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {error ?? `${formatCAD(parsed[0]?.amount ?? 0)} + ${formatCAD(others)} = ${formatCAD(total)}`}
        </p>
        <Button
          disabled={error !== null || split.isPending}
          onClick={() =>
            transaction &&
            split.mutate(
              { transaction, parts: parsed },
              { onSuccess: () => onOpenChange(false) }
            )
          }
        >
          Split into {parts.length} parts
        </Button>
      </DialogContent>
    </Dialog>
  );
}
