"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SpendingDonut,
  type DonutCompare,
} from "@/components/dashboard/SpendingDonut";
import { topCategories } from "@/lib/utils/aggregate";
import {
  categoryBreakdown,
  PERIOD_LABELS,
  type SpendingPeriod,
} from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

const COMPARE_BY_PERIOD: Record<SpendingPeriod, DonutCompare> = {
  this_month: "so_far",
  last_month: "delta",
  "3_months": "delta",
  "12_months": "per_month",
};

const EMPTY_LABELS: Record<SpendingPeriod, string> = {
  this_month: "No expenses recorded this month yet.",
  last_month: "No expenses recorded last month.",
  "3_months": "No expenses in the last 3 months.",
  "12_months": "No expenses in the last 12 months.",
};

/** Dashboard donut with a period picker and "vs your usual" per category. */
export function SpendingByCategory({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [period, setPeriod] = useState<SpendingPeriod>("this_month");
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, period),
    [transactions, period]
  );

  // Fold the tail but keep each row's comparison numbers.
  const rows = useMemo(() => {
    const top = topCategories(breakdown.rows, 6);
    return top.map(
      (t) => breakdown.rows.find((r) => r.category === t.category) ?? t
    );
  }, [breakdown]);

  return (
    <SpendingDonut
      data={rows}
      categories={categories}
      emptyLabel={EMPTY_LABELS[period]}
      description={`${breakdown.label} · click a category to see its transactions`}
      range={{ start: breakdown.start, end: breakdown.end }}
      compare={COMPARE_BY_PERIOD[period]}
      headerAction={
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as SpendingPeriod)}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as SpendingPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
