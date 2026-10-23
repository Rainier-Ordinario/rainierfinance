"use client";

import { useMemo, useState } from "react";
import { Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useConvertToRefunds,
  useTransactions,
} from "@/lib/hooks/useTransactions";
import { useMerchantRules } from "@/lib/hooks/useMerchantRules";
import {
  knownMerchantsFrom,
  looksLikeRefund,
  refundCategory,
} from "@/lib/utils/categorize";
import { formatCAD } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";

const DISMISS_KEY = "possible-refunds-dismissed";

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Income rows that look like money back from a store, offered for one-click
 * conversion to refunds. Catches history imported before refunds were
 * detected, and anything the importer wasn't sure about.
 */
export function PossibleRefunds() {
  const all = useTransactions();
  const rules = useMerchantRules();
  const convert = useConvertToRefunds();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const candidates = useMemo(() => {
    const txs = all.data ?? [];
    const known = knownMerchantsFrom(txs);
    return txs
      .filter(
        (t) =>
          t.type === "income" &&
          !dismissed.has(t.id) &&
          looksLikeRefund(t.description, known, rules)
      )
      .map((t) => ({ tx: t, category: refundCategory(t.description, known, rules) }));
  }, [all.data, rules, dismissed]);

  if (candidates.length === 0) return null;
  const selected = candidates.filter((c) => !unchecked.has(c.tx.id));

  function dismissAll() {
    const next = new Set([...dismissed, ...candidates.map((c) => c.tx.id)]);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch {
      // Private mode: dismissal lasts this session only.
    }
    setDismissed(next);
  }

  return (
    <div className="mb-4 rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Undo2 className="hidden size-5 shrink-0 text-warning sm:block" aria-hidden />
        <p className="flex-1 text-sm">
          <span className="font-medium">
            {candidates.length} {candidates.length === 1 ? "credit looks" : "credits look"} like
            refunds
          </span>{" "}
          but are counted as income, which overstates your income and savings
          rate.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Review"}
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={dismissAll} aria-label="Dismiss">
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t pt-3">
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map(({ tx, category }) => {
              const checked = !unchecked.has(tx.id);
              return (
                <li key={tx.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setUnchecked((prev) => {
                          const next = new Set(prev);
                          if (v) next.delete(tx.id);
                          else next.add(tx.id);
                          return next;
                        })
                      }
                    />
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{tx.description}</span>
                    <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
                      → {category}
                    </span>
                    <span className="shrink-0 text-numeric text-success">
                      +{formatCAD(Number(tx.amount))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Unticked rows stay as income. Refunds go to the category shown.
            </p>
            <Button
              size="sm"
              disabled={selected.length === 0 || convert.isPending}
              onClick={() =>
                convert.mutate(
                  selected.map((c) => ({ id: c.tx.id, category: c.category })),
                  { onSuccess: () => setExpanded(false) }
                )
              }
            >
              Mark {selected.length} as refunds
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
