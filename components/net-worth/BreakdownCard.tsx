"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCAD } from "@/lib/utils/currency";
import { totalAssets, totalLiabilities } from "@/lib/utils/aggregate";
import type { Account } from "@/types";

function Row({ account, max }: { account: Account; max: number }) {
  const value = Number(account.balance);
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="min-w-0 truncate">{account.name}</span>
        <span className="text-numeric ml-3 shrink-0">{formatCAD(value)}</span>
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
          <ul className="space-y-2.5">
            {assets.map((a) => (
              <Row key={a.id} account={a} max={maxAsset} />
            ))}
          </ul>
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
