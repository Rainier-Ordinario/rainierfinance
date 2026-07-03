"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/lib/hooks/useSettings";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { estimateAvionPoints } from "@/lib/utils/portfolio";
import { currentMonthRange } from "@/lib/utils/dates";
import type { Account } from "@/types";

const POINTS_FORMAT = new Intl.NumberFormat("en-CA");

export function AvionPointsCard({ cards }: { cards: Account[] }) {
  const settings = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const range = currentMonthRange();
  const cardIds = cards.map((c) => c.id);
  const transactions = useTransactions({
    accountIds: cardIds,
    type: "expense",
    dateFrom: range.start,
    dateTo: range.end,
  });

  const earnedThisMonth = useMemo(
    () =>
      (transactions.data ?? []).reduce(
        (sum, t) => sum + estimateAvionPoints(Number(t.amount), t.category),
        0
      ),
    [transactions.data]
  );

  const balance = settings.data?.avion_points_balance ?? 0;

  function save() {
    const value = Math.max(0, Math.round(Number(draft)));
    if (!Number.isNaN(value)) {
      updateSettings.mutate({ avion_points_balance: value });
    }
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Avion Points</CardTitle>
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Current balance</p>
          {editing ? (
            <form
              className="mt-1 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Input
                autoFocus
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="text-numeric h-9 w-36"
                aria-label="Avion points balance"
              />
              <Button
                type="submit"
                size="icon"
                variant="outline"
                className="size-9"
                aria-label="Save points balance"
              >
                <Check className="size-4" aria-hidden />
              </Button>
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-numeric text-3xl font-semibold">
                {POINTS_FORMAT.format(balance)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => {
                  setDraft(String(balance));
                  setEditing(true);
                }}
                aria-label="Edit points balance"
              >
                <Pencil className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Estimated earned this month
          </p>
          <p className="text-numeric font-medium">
            ≈ {POINTS_FORMAT.format(earnedThisMonth)} pts
            <span className="ml-1 font-normal text-muted-foreground">
              from card spend (3x on ION+ categories)
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
