"use client";

import { Radar, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUpsertSubscription } from "@/lib/hooks/useSubscriptions";
import { formatCAD } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/dates";
import type { DetectedSubscription } from "@/lib/utils/subscriptions";

export function DetectedSubscriptions({
  detected,
}: {
  detected: DetectedSubscription[];
}) {
  const upsert = useUpsertSubscription();

  if (detected.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Radar className="size-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base">
          Detected recurring charges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          These charges repeat monthly in your transactions but aren&apos;t
          tracked as subscriptions yet.
        </p>
        {detected.map((d) => (
          <div
            key={d.name}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                <span className="text-numeric">{formatCAD(d.amount)}</span>/mo ·
                seen {d.occurrences}× · next ~
                {formatDateShort(d.next_billing_date)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={upsert.isPending}
              onClick={() =>
                upsert.mutate({
                  name: d.name,
                  amount: d.amount,
                  billing_cycle: "monthly",
                  next_billing_date: d.next_billing_date,
                  category: d.category,
                  account_id: d.account_id,
                  status: "active",
                })
              }
            >
              <Plus className="size-3.5" aria-hidden />
              Track
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
