"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCAD } from "@/lib/utils/currency";
import { totalAssets, totalLiabilities } from "@/lib/utils/aggregate";
import { useUpsertAccount } from "@/lib/hooks/useAccounts";
import type { Account } from "@/types";

function Row({ account, max }: { account: Account; max: number }) {
  const upsertAccount = useUpsertAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const value = Number(account.balance);

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
  }

  async function save() {
    const parsed = Number.parseFloat(draft);
    if (Number.isNaN(parsed) || parsed < 0) return;
    await upsertAccount.mutateAsync({
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      balance: parsed,
    });
    setEditing(false);
  }

  return (
    <li className="group">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="min-w-0 truncate">{account.name}</span>
        {editing ? (
          <span className="ml-3 flex shrink-0 items-center gap-1">
            <Input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-7 w-28 text-right text-sm"
              aria-label={`Balance for ${account.name}`}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={save}
              disabled={upsertAccount.isPending}
              aria-label="Save balance"
            >
              <Check className="size-3.5 text-success" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(false)}
              aria-label="Cancel"
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </span>
        ) : (
          <span className="ml-3 flex shrink-0 items-center gap-1">
            <span className="text-numeric">{formatCAD(value)}</span>
            <button
              type="button"
              onClick={startEdit}
              aria-label={`Edit balance for ${account.name}`}
              className="text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              <Pencil className="size-3" aria-hidden />
            </button>
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            background: account.color,
          }}
        />
      </div>
    </li>
  );
}

export function BreakdownCard({ accounts }: { accounts: Account[] }) {
  const active = accounts.filter((a) => a.is_active);
  const assets = active
    .filter((a) => a.type !== "credit_card")
    .sort((a, b) => Number(b.balance) - Number(a.balance));
  const liabilities = active
    .filter((a) => a.type === "credit_card")
    .sort((a, b) => Number(b.balance) - Number(a.balance));
  const maxAsset = Math.max(...assets.map((a) => Number(a.balance)), 0);
  const maxLiability = Math.max(
    ...liabilities.map((a) => Number(a.balance)),
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <p className="font-medium">Assets</p>
            <p className="text-numeric text-success">
              {formatCAD(totalAssets(active))}
            </p>
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts yet — import a CSV or add accounts to get started.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {assets.map((a) => (
                <Row key={a.id} account={a} max={maxAsset} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <p className="font-medium">Liabilities</p>
            <p className="text-numeric text-destructive">
              {formatCAD(totalLiabilities(active))}
            </p>
          </div>
          {liabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">None. 🎉</p>
          ) : (
            <ul className="space-y-2.5">
              {liabilities.map((a) => (
                <Row key={a.id} account={a} max={maxLiability} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
