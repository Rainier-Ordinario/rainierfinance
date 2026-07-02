"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
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
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { FilterPanel } from "@/components/transactions/FilterPanel";
import { CSVImporter } from "@/components/transactions/CSVImporter";
import {
  useBulkCategorize,
  useDeleteTransactions,
  useTransactions,
  type TransactionFilters,
} from "@/lib/hooks/useTransactions";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCategories } from "@/lib/hooks/useCategories";
import { downloadCsv } from "@/lib/utils/exportCsv";
import type { Transaction } from "@/types";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const transactions = useTransactions(filters);
  const accounts = useAccounts();
  const categories = useCategories();
  const deleteTxs = useDeleteTransactions();
  const bulkCategorize = useBulkCategorize();

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
        description="Every dollar in and out"
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search descriptions…"
          value={filters.search ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value || undefined }))
          }
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
                bulkCategorize.mutate(
                  { ids: [...selected], category },
                  { onSuccess: () => setSelected(new Set()) }
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
