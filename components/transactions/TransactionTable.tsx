"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Merge,
  Pencil,
  Split,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import {
  formatCAD,
  formatCADSigned,
  formatTransactionAmount,
} from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { isRefund, spendOf } from "@/lib/utils/aggregate";
import { merchantKey } from "@/lib/utils/categorize";
import { cn } from "@/lib/utils";
import { CategoryDot } from "@/components/dashboard/RecentTransactions";
import type { Account, Category, Transaction } from "@/types";

const PAGE_SIZE = 25;

type SortKey = "date" | "description" | "category" | "amount" | "type";

export function TransactionTable({
  transactions,
  accounts,
  categories,
  selected,
  onSelectedChange,
  onEdit,
  onDelete,
  onSplit,
  onUnsplit,
  onMerchant,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onUnsplit?: (transaction: Transaction) => void;
  /** Open a merchant's history, by merchantKey. */
  onMerchant?: (key: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount);
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Group by day when sorted by date; other sort orders show a flat list.
  const groupByDay = sortKey === "date";
  const dayGroups = useMemo(() => {
    if (!groupByDay) return null;
    // Signed day net: income adds, spending subtracts (refunds add back),
    // transfers are neutral.
    const signed = (t: Transaction) =>
      t.type === "income" ? Math.abs(Number(t.amount)) : -spendOf(t);
    const groups: {
      date: string;
      net: number;
      rows: Transaction[];
      /** Set on the first group of each month visible on this page. */
      monthHeader?: {
        label: string;
        income: number;
        expenses: number;
        refunds: number;
      };
    }[] = [];
    for (const t of pageRows) {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) {
        last.rows.push(t);
        last.net += signed(t);
      } else {
        groups.push({ date: t.date, net: signed(t), rows: [t] });
      }
    }
    // Month separators with in/out sums for the month's rows on this page.
    let currentMonth = "";
    for (const g of groups) {
      const month = g.date.slice(0, 7);
      if (month === currentMonth) continue;
      currentMonth = month;
      const monthRows = pageRows.filter((t) => t.date.slice(0, 7) === month);
      g.monthHeader = {
        label: format(parseISO(`${month}-01`), "MMMM yyyy"),
        income: monthRows
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
        expenses: monthRows
          .filter((t) => spendOf(t) > 0)
          .reduce((s, t) => s + spendOf(t), 0),
        refunds: monthRows
          .filter(isRefund)
          .reduce((s, t) => s + Number(t.amount), 0),
      };
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupByDay, sorted, currentPage]);

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "—";

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key !== "date" && key !== "amount");
    }
  }

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((t) => selected.has(t.id));

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach((t) => next.delete(t.id));
    else pageRows.forEach((t) => next.add(t.id));
    onSelectedChange(next);
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  function SortableHead({
    label,
    sort,
    className,
  }: {
    label: string;
    sort: SortKey;
    className?: string;
  }) {
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(sort)}
          className="inline-flex items-center gap-1 hover:text-foreground"
          aria-label={`Sort by ${label}`}
        >
          {label}
          <ArrowUpDown
            className={cn(
              "size-3",
              sortKey === sort ? "opacity-100" : "opacity-30"
            )}
            aria-hidden
          />
        </button>
      </TableHead>
    );
  }

  const renderTxRow = (t: Transaction) => (
    <TableRow
      key={t.id}
      data-state={selected.has(t.id) ? "selected" : undefined}
    >
      <TableCell>
        <Checkbox
          checked={selected.has(t.id)}
          onCheckedChange={() => toggleRow(t.id)}
          aria-label={`Select ${t.description}`}
        />
      </TableCell>
      <TableCell className="text-numeric whitespace-nowrap text-sm text-muted-foreground">
        {groupByDay ? "" : formatDate(t.date)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{accountName(t.account_id)}</Badge>
      </TableCell>
      <TableCell className="max-w-56 truncate font-medium">
        {onMerchant && t.type === "expense" ? (
          <button
            type="button"
            onClick={() => onMerchant(merchantKey(t.description))}
            className="max-w-full truncate text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            title="See this merchant's history"
          >
            {t.description}
          </button>
        ) : (
          t.description
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2 text-sm">
          <CategoryDot category={t.category} categories={categories} />
          {t.category}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "text-numeric text-right font-medium",
          (t.type === "income" || isRefund(t)) && "text-success",
          t.type === "transfer" && "text-muted-foreground"
        )}
      >
        {formatTransactionAmount(Number(t.amount), t.type)}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={cn(
            (t.type === "income" || isRefund(t)) && "text-success",
            t.type === "transfer" && "text-muted-foreground"
          )}
        >
          {isRefund(t) ? "refund" : t.type}
        </Badge>
        {t.split_group && (
          <Badge variant="outline" className="ml-1">
            split
          </Badge>
        )}
        {t.pending && (
          <Badge
            variant="outline"
            className="ml-1 text-muted-foreground"
            title="Not posted by the bank yet; the amount may still change"
          >
            pending
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {t.split_group
            ? onUnsplit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onUnsplit(t)}
                  aria-label={`Undo split of ${t.description}`}
                  title="Undo split"
                >
                  <Merge className="size-3.5" aria-hidden />
                </Button>
              )
            : onSplit &&
              t.type === "expense" &&
              !isRefund(t) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSplit(t)}
                  aria-label={`Split ${t.description}`}
                  title="Split across categories"
                >
                  <Split className="size-3.5" aria-hidden />
                </Button>
              )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(t)}
            aria-label={`Edit ${t.description}`}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(t)}
            aria-label={`Delete ${t.description}`}
          >
            <Trash2 className="size-3.5 text-destructive" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleAllOnPage}
                  aria-label="Select all on page"
                />
              </TableHead>
              <SortableHead label="Date" sort="date" />
              <TableHead>Account</TableHead>
              <SortableHead label="Description" sort="description" />
              <SortableHead label="Category" sort="category" />
              <SortableHead label="Amount" sort="amount" className="text-right" />
              <SortableHead label="Type" sort="type" />
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayGroups
              ? dayGroups.map((g) => (
                  <Fragment key={g.date}>
                    {g.monthHeader && (
                      <TableRow className="bg-accent/50 hover:bg-accent/50">
                        <TableCell colSpan={8} className="py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold tracking-[-0.01em]">
                              {g.monthHeader.label}
                            </span>
                            <span className="text-numeric text-xs">
                              <span className="text-success">
                                in {formatCAD(g.monthHeader.income)}
                              </span>
                              <span className="mx-1.5 text-muted-foreground">
                                ·
                              </span>
                              <span className="text-muted-foreground">
                                out {formatCAD(g.monthHeader.expenses)}
                              </span>
                              {g.monthHeader.refunds > 0 && (
                                <>
                                  <span className="mx-1.5 text-muted-foreground">
                                    ·
                                  </span>
                                  <span className="text-success">
                                    refunds {formatCAD(g.monthHeader.refunds)}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={8} className="py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {formatDate(g.date)}
                            <span className="ml-2 font-normal normal-case tracking-normal">
                              {g.rows.length} transaction
                              {g.rows.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "text-numeric text-xs font-medium",
                              g.net >= 0
                                ? "text-success"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatCADSigned(g.net)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {g.rows.map(renderTxRow)}
                  </Fragment>
                ))
              : pageRows.map(renderTxRow)}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {sorted.length} transactions · page {currentPage + 1} of {pageCount}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
