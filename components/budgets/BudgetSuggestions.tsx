"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { useUpsertBudget } from "@/lib/hooks/useBudgets";
import {
  budgetEmoji,
  suggestBudgets,
  type CategoryBudgetSuggestion,
} from "@/lib/utils/budgets";
import { formatCADWhole } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import type { Budget, Category, Transaction } from "@/types";

/**
 * One-click budgets for everyday categories that have none yet, priced
 * from what the user actually spends there.
 */
export function BudgetSuggestions({
  transactions,
  categories,
  budgets,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}) {
  const upsert = useUpsertBudget();
  const suggestions = useMemo(
    () => suggestBudgets(transactions, categories, budgets),
    [transactions, categories, budgets]
  );
  if (suggestions.length === 0) return null;

  function add(s: CategoryBudgetSuggestion, amount: number) {
    upsert.mutate({
      name: s.category.name,
      emoji: budgetEmoji(s.category.name),
      total_amount: amount,
      period: "monthly",
      category: s.category.name,
      color: s.category.color,
      start_date: toISODate(new Date()),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested budgets</CardTitle>
        <CardDescription>
          Everyday categories you spend on without a budget, priced from your
          last few months. Match your habit, or trim it a little.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {suggestions.map((s) => (
            <li
              key={s.category.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2">
                <CategoryIcon
                  category={s.category.name}
                  categories={categories}
                />
                <span>
                  <span className="block text-sm font-medium">
                    {s.category.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    usually {formatCADWhole(s.usual)}/mo
                  </span>
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={upsert.isPending}
                  onClick={() => add(s, s.suggested)}
                  aria-label={`Add a ${formatCADWhole(s.suggested)} monthly budget for ${s.category.name}`}
                >
                  Add {formatCADWhole(s.suggested)}
                </Button>
                <Button
                  size="sm"
                  disabled={upsert.isPending}
                  onClick={() => add(s, s.trimmed)}
                  aria-label={`Add a ${formatCADWhole(s.trimmed)} monthly budget for ${s.category.name}, about 10% under usual`}
                >
                  Trim to {formatCADWhole(s.trimmed)}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
