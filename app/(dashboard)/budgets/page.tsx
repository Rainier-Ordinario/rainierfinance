"use client";

import { useMemo, useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  CardSkeleton,
  StatCardSkeleton,
} from "@/components/shared/CardSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetModal } from "@/components/budgets/BudgetModal";
import { BudgetDetail } from "@/components/budgets/BudgetDetail";
import { BudgetsReview } from "@/components/budgets/BudgetsReview";
import { useBudgets, useDeleteBudget } from "@/lib/hooks/useBudgets";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { budgetProgress } from "@/lib/utils/budgets";
import { formatCAD } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Budget } from "@/types";

export default function BudgetsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [viewing, setViewing] = useState<Budget | null>(null);

  const budgets = useBudgets();
  const transactions = useTransactions();
  const deleteBudget = useDeleteBudget();

  const all = useMemo(() => budgets.data ?? [], [budgets.data]);
  const txs = useMemo(() => transactions.data ?? [], [transactions.data]);

  const withProgress = useMemo(
    () => all.map((b) => ({ budget: b, progress: budgetProgress(b, txs) })),
    [all, txs]
  );

  const totals = useMemo(() => {
    const budgeted = all.reduce((s, b) => s + Number(b.total_amount), 0);
    const spent = withProgress.reduce((s, { progress }) => s + progress.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [all, withProgress]);

  const isLoading = budgets.isLoading || transactions.isLoading;

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Spending limits by category, computed from your transactions"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add budget
          </Button>
        }
      />

      {isLoading ? (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        </>
      ) : all.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets"
          description="Set a limit for a spending category and track your pace against it."
          actionLabel="Add budget"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Budgeted</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.budgeted)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.spent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={cn(
                    "text-numeric mt-1 text-2xl font-semibold",
                    totals.remaining >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {formatCAD(totals.remaining)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {withProgress.map(({ budget, progress }) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                progress={progress}
                onOpen={() => setViewing(budget)}
                onEdit={() => {
                  setEditing(budget);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleting(budget)}
              />
            ))}
          </div>

          <div className="mt-4">
            <BudgetsReview budgets={all} transactions={txs} />
          </div>
        </>
      )}

      <BudgetModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
      />

      {viewing && (
        <BudgetDetail
          budget={viewing}
          transactions={txs}
          onOpenChange={(o) => !o && setViewing(null)}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteBudget.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
