"use client";

import { useMemo, useState } from "react";
import { LifeBuoy, Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/CardSkeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalModal, type GoalDraft } from "@/components/goals/GoalModal";
import { ChallengesCard } from "@/components/goals/ChallengesCard";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCategories } from "@/lib/hooks/useCategories";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { isMissingTable, useDeleteGoal, useGoals } from "@/lib/hooks/useGoals";
import { formatCADWhole } from "@/lib/utils/currency";
import {
  emergencyRunway,
  goalProgress,
  recentMonthlySaving,
} from "@/lib/utils/goals";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types";

export default function GoalsPage() {
  const goals = useGoals();
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();
  const deleteGoal = useDeleteGoal();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const txs = useMemo(() => transactions.data ?? [], [transactions.data]);
  const accts = useMemo(() => accounts.data ?? [], [accounts.data]);
  const monthlySaving = useMemo(() => recentMonthlySaving(txs), [txs]);
  const runway = useMemo(
    () => emergencyRunway(txs, categories.data ?? [], accts),
    [txs, categories.data, accts]
  );

  const loading =
    goals.isLoading || accounts.isLoading || transactions.isLoading;
  const needsMigration = goals.error && isMissingTable(goals.error);
  const list = goals.data ?? [];
  const hasEmergencyFund = list.some((g) => /emergency/i.test(g.name));

  function create(nextDraft: GoalDraft | null = null) {
    setEditing(null);
    setDraft(nextDraft);
    setModalOpen(true);
  }
  const emergencyDraft: GoalDraft = {
    name: "Emergency fund",
    emoji: "🛟",
    target_amount: runway.suggestedTarget,
  };

  return (
    <div>
      <PageHeader
        title="Goals"
        description="What you're saving for, and whether your pace gets you there"
        actions={
          !needsMigration && (
            <Button onClick={() => create()}>
              <Plus className="size-4" aria-hidden />
              New goal
            </Button>
          )
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : needsMigration ? (
        <EmptyState
          icon={Target}
          title="One step left"
          description="Goals and challenges need a database update. Run supabase/migrations/007_goals_challenges_splits.sql in the Supabase SQL editor, then reload."
        />
      ) : (
        <div className="space-y-4">
          {runway.monthlyNeeds > 0 && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LifeBuoy className="size-4 text-muted-foreground" aria-hidden />
                    Emergency runway
                  </CardTitle>
                  <CardDescription>
                    How long your chequing and savings would cover your usual
                    bills and essentials ({formatCADWhole(runway.monthlyNeeds)}
                    /mo) with no income.
                  </CardDescription>
                </div>
                {!hasEmergencyFund && (
                  <Button variant="outline" size="sm" onClick={() => create(emergencyDraft)}>
                    Start a {formatCADWhole(runway.suggestedTarget)} emergency fund
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-numeric text-3xl font-semibold",
                    (runway.months ?? 0) < 1
                      ? "text-destructive"
                      : (runway.months ?? 0) < 3
                        ? "text-warning"
                        : "text-success"
                  )}
                >
                  {(runway.months ?? 0).toFixed(1)} months
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCADWhole(runway.cash)} in cash. Three months is a
                  common target; six if your income is irregular.
                </p>
              </CardContent>
            </Card>
          )}

          {list.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Give your savings a job: an emergency fund, a trip, a down payment."
              actionLabel="Create a goal"
              onAction={() => create()}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  progress={goalProgress(g, accts, monthlySaving)}
                  monthlySaving={monthlySaving}
                  accounts={accts}
                  onEdit={() => {
                    setEditing(g);
                    setModalOpen(true);
                  }}
                  onDelete={() => setDeleting(g)}
                />
              ))}
            </div>
          )}

          <ChallengesCard
            transactions={txs}
            categories={categories.data ?? []}
          />
        </div>
      )}

      <GoalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        draft={draft}
        accounts={accts}
      />

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
                if (deleting) deleteGoal.mutate(deleting.id);
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
