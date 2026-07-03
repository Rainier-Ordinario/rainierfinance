"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsertSnapshot } from "@/lib/hooks/useSnapshots";
import { formatCAD } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Account } from "@/types";

const LIABILITY_TYPES = new Set(["credit_card"]);

/**
 * Log a snapshot of today's balances. Prefilled from current account
 * balances; each is editable so the user can correct stale numbers first.
 */
export function SnapshotModal({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}) {
  const upsert = useUpsertSnapshot();
  const active = useMemo(
    () => accounts.filter((a) => a.is_active),
    [accounts]
  );

  const [date, setDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDate(toISODate(new Date()));
      setNotes("");
      setBalances(
        Object.fromEntries(active.map((a) => [a.id, String(a.balance)]))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const a of active) {
      const value = Number(balances[a.id] ?? 0) || 0;
      if (LIABILITY_TYPES.has(a.type)) liabilities += value;
      else assets += value;
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [active, balances]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate(
      {
        snapshot_date: date,
        account_balances: Object.fromEntries(
          active.map((a) => [a.id, Number(balances[a.id] ?? 0) || 0])
        ),
        total_assets: totals.assets,
        total_liabilities: totals.liabilities,
        net_worth: totals.netWorth,
        notes: notes.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log snapshot</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snap-date">Date</Label>
            <Input
              id="snap-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {active.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: a.color }}
                  aria-hidden
                />
                <Label
                  htmlFor={`snap-${a.id}`}
                  className="min-w-0 flex-1 truncate font-normal"
                >
                  {a.name}
                  {LIABILITY_TYPES.has(a.type) && (
                    <span className="text-muted-foreground"> (owed)</span>
                  )}
                </Label>
                <Input
                  id={`snap-${a.id}`}
                  type="number"
                  step="any"
                  className="text-numeric w-32"
                  value={balances[a.id] ?? ""}
                  onChange={(e) =>
                    setBalances((b) => ({ ...b, [a.id]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="snap-notes">Notes (optional)</Label>
            <Input
              id="snap-notes"
              placeholder="Bonus month, sold some BTC…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Net worth</span>
            <span
              className={cn(
                "text-numeric font-semibold",
                totals.netWorth >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatCAD(totals.netWorth)}
            </span>
          </div>

          <Button type="submit" className="w-full" disabled={upsert.isPending}>
            Save snapshot
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
