"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransactionFilters } from "@/lib/hooks/useTransactions";
import type { Account, Category, TransactionType } from "@/types";

export const AMOUNT_RANGE: [number, number] = [-5000, 5000];

export function FilterPanel({
  filters,
  onChange,
  accounts,
  categories,
  onClose,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  function toggleId(list: string[] | undefined, id: string): string[] {
    const current = list ?? [];
    return current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
  }

  const amountValue: [number, number] = [
    filters.amountMin ?? AMOUNT_RANGE[0],
    filters.amountMax ?? AMOUNT_RANGE[1],
  ];

  return (
    <div className="w-full shrink-0 space-y-5 rounded-xl border bg-card p-4 lg:w-64">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ search: filters.search })}
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">
          Date range
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) =>
              onChange({ ...filters, dateFrom: e.target.value || undefined })
            }
            aria-label="From date"
          />
          <Input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) =>
              onChange({ ...filters, dateTo: e.target.value || undefined })
            }
            aria-label="To date"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">
          Accounts
        </Label>
        <div className="space-y-1.5">
          {accounts.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={(filters.accountIds ?? []).includes(a.id)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    accountIds: toggleId(filters.accountIds, a.id),
                  })
                }
              />
              {a.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">
          Categories
        </Label>
        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={(filters.categories ?? []).includes(c.name)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    categories: toggleId(filters.categories, c.name),
                  })
                }
              />
              <span
                className="size-2 rounded-full"
                style={{ background: c.color }}
                aria-hidden
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Type</Label>
        <Select
          value={filters.type ?? "all"}
          onValueChange={(v) =>
            onChange({
              ...filters,
              type: v === "all" ? undefined : (v as TransactionType),
            })
          }
        >
          <SelectTrigger aria-label="Transaction type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs uppercase text-muted-foreground">
          Amount range
        </Label>
        <Slider
          min={AMOUNT_RANGE[0]}
          max={AMOUNT_RANGE[1]}
          step={50}
          value={amountValue}
          onValueChange={([min, max]) =>
            onChange({
              ...filters,
              amountMin: min === AMOUNT_RANGE[0] ? undefined : min,
              amountMax: max === AMOUNT_RANGE[1] ? undefined : max,
            })
          }
          aria-label="Amount range"
        />
        <p className="text-numeric text-xs text-muted-foreground">
          ${amountValue[0]} to ${amountValue[1]}
        </p>
      </div>
    </div>
  );
}
