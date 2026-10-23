"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { useSetCategoryKind } from "@/lib/hooks/useCategories";
import {
  categoryKind,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  NOT_SPENDING,
} from "@/lib/utils/spending";
import type { Category, CategoryKind } from "@/types";

const KINDS: CategoryKind[] = ["fixed", "essential", "discretionary"];

/** Choose which spending categories are fixed, essential, or discretionary. */
export function CategoryGroupsCard({ categories }: { categories: Category[] }) {
  const setKind = useSetCategoryKind();
  const spending = categories.filter(
    (c) => c.type !== "income" && !NOT_SPENDING.has(c.name)
  );

  return (
    <Card id="category-groups" className="scroll-mt-20 lg:col-span-2">
      <CardHeader>
        <CardTitle>Spending groups</CardTitle>
        <CardDescription>
          Sort categories into fixed bills, essentials, and discretionary
          wants. The dashboard paces each group against last month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="mb-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {KINDS.map((k) => (
            <div key={k}>
              <dt className="font-medium text-foreground">{KIND_LABELS[k]}</dt>
              <dd>{KIND_DESCRIPTIONS[k]}</dd>
            </div>
          ))}
        </dl>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {spending.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <CategoryIcon category={c.name} categories={categories} />
                <span className="truncate">{c.name}</span>
              </span>
              <Select
                value={categoryKind(c.name, categories)}
                onValueChange={(kind) =>
                  setKind.mutate({ id: c.id, kind: kind as CategoryKind })
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-36"
                  aria-label={`Group for ${c.name}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
