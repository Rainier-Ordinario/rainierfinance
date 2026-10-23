"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeftRight,
  Download,
  Filter,
  Plus,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/CardSkeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { FilterPanel } from "@/components/transactions/FilterPanel";
import { CSVImporter } from "@/components/transactions/CSVImporter";
import { TrendPanel } from "@/components/transactions/TrendPanel";
import { PossibleRefunds } from "@/components/transactions/PossibleRefunds";
import {
  useBulkCategorize,
  useDeleteTransactions,
  useTransactions,
  useTransactionsLastUpdated,
  type TransactionFilters,
} from "@/lib/hooks/useTransactions";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCategories } from "@/lib/hooks/useCategories";
import { useLearnMerchantCategory } from "@/lib/hooks/useMerchantRules";
import { downloadCsv } from "@/lib/utils/exportCsv";
import type { Transaction, TransactionType } from "@/types";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Spending" },
  { value: "transfer", label: "Transfers" },
] as const;

function TransactionsContent() {
  const searchParams = useSearchParams();
  // Deep links (e.g. a dashboard chart slice) arrive as
  // ?type=expense&category=Dining&from=2026-09-01&to=2026-09-30
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    return {
      ...(search ? { search } : {}),
      ...(type === "income" || type === "expense" || type === "transfer"
        ? { type }
        : {}),
      ...(category ? { categories: [category] } : {}),
      ...(searchParams.get("from")
        ? { dateFrom: searchParams.get("from")! }
        : {}),
      ...(searchParams.get("to") ? { dateTo: searchParams.get("to")! } : {}),
    };
  });
  const [showFilters, setShowFilters] = useState(
    () => searchParams.has("category") || searchParams.has("from")
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const shouldFocusSearch = searchParams.get("focus") === "search";

  useEffect(() => {
    if (shouldFocusSearch) searchRef.current?.focus();
  }, [shouldFocusSearch]);

  // The search box updates the query filters (and so the server request)
  // only after a typing pause — one request per search, not per keystroke.
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? ""
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) =>
        (f.search ?? "") === searchInput.trim()
          ? f
          : { ...f, search: searchInput.trim() || undefined }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const transactions = useTransactions(filters);
  const lastUpdated = useTransactionsLastUpdated();
  const accounts = useAccounts();
  const categories = useCategories();
  const deleteTxs = useDeleteTransactions();
  const bulkCategorize = useBulkCategorize();
  const learn = useLearnMerchantCategory();

  const rows = transactions.data ?? [];
  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && (!Array.isArray(v) || v.length > 0)
  );

  function exportAll() {
    downloadCsv(
      "transactions.csv",
      rows.map((t) => ({
        Date: t.date,
        Account:
          accounts.data?.find((a) => a.id === t.account_id)?.name ?? "",
        Description: t.description,
        Category: t.category,
        Amount: t.amount,
        Type: t.type,
        Notes: t.notes ?? "",
      }))
    );
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={
          lastUpdated.data
            ? `Every dollar in and out · Last updated ${format(
                parseISO(lastUpdated.data),
                "MMM d, yyyy 'at' h:mm a"
              )}`
            : "Every dollar in and out"
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden />
              Import CSV
            </Button>
            <Button variant="outline" onClick={exportAll} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add
            </Button>
          </>
        }
      />

      <PossibleRefunds />

      <Tabs
        value={filters.type ?? "all"}
        onValueChange={(v) =>
          setFilters((f) => ({
            ...f,
            type: v === "all" ? undefined : (v as TransactionType),
          }))
        }
        className="mb-4"
      >
        <TabsList>
          {TYPE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          ref={searchRef}
          placeholder="Search descriptions…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
          aria-label="Search transactions"
        />
        <Button
          variant={showFilters || hasActiveFilters ? "secondary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="size-4" aria-hidden />
          Filters
        </Button>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Select
              onValueChange={(category) => {
                // Expenses teach their merchants the new category too.
                const descriptions = rows
                  .filter((t) => selected.has(t.id) && t.type === "expense")
                  .map((t) => t.description);
                bulkCategorize.mutate(
                  { ids: [...selected], category },
                  {
                    onSuccess: () => {
                      setSelected(new Set());
                      learn.mutate({ descriptions, category });
                    },
                  }
                );
              }}
            >
              <SelectTrigger className="w-44" aria-label="Bulk categorize">
                <Tag className="size-3.5" aria-hidden />
                <SelectValue placeholder="Categorize as…" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
            onClose={() => setShowFilters(false)}
          />
        )}

        <div className="min-w-0 flex-1">
          {!transactions.isLoading && rows.length > 0 && (
            <TrendPanel transactions={rows} type={filters.type} />
          )}
          {transactions.isLoading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={hasActiveFilters ? "No matches" : "No transactions yet"}
              description={
                hasActiveFilters
                  ? "Try loosening your filters."
                  : "Add a transaction manually or import your RBC CSV export."
              }
              actionLabel={hasActiveFilters ? undefined : "Add transaction"}
              onAction={
                hasActiveFilters ? undefined : () => setModalOpen(true)
              }
            />
          ) : (
            <TransactionTable
              transactions={rows}
              accounts={accounts.data ?? []}
              categories={categories.data ?? []}
              selected={selected}
              onSelectedChange={setSelected}
              onEdit={(t) => {
                setEditing(t);
                setModalOpen(true);
              }}
              onDelete={setDeleting}
            />
          )}
        </div>
      </div>

      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
        editing={editing}
      />

      <CSVImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts.data ?? []}
      />

      {/* Single delete confirm */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.description}” will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (deleting) deleteTxs.mutate([deleting.id]);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} transactions?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                deleteTxs.mutate([...selected], {
                  onSuccess: () => setSelected(new Set()),
                });
                setBulkDeleteOpen(false);
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsContent />
    </Suspense>
  );
}
