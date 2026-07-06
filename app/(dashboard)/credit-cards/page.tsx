"use client";

import { useMemo, useState } from "react";
import { CreditCard, Plus } from "lucide-react";
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
import { CardVisual } from "@/components/credit-cards/CardVisual";
import { UtilizationTracker } from "@/components/credit-cards/UtilizationTracker";
import { PaymentSchedule } from "@/components/credit-cards/PaymentSchedule";
import { AvionPointsCard } from "@/components/credit-cards/AvionPointsCard";
import { CardRecommender } from "@/components/credit-cards/CardRecommender";
import { CardModal } from "@/components/credit-cards/CardModal";
import { useAccounts, useDeleteAccount } from "@/lib/hooks/useAccounts";
import { usePaymentReminders } from "@/lib/hooks/useSettings";
import { useSnapshots } from "@/lib/hooks/useSnapshots";
import { formatCAD, formatPercent } from "@/lib/utils/currency";
import { calculateUtilization } from "@/lib/utils/portfolio";
import type { Account } from "@/types";

export default function CreditCardsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const accounts = useAccounts();
  const reminders = usePaymentReminders();
  const snapshots = useSnapshots();
  const deleteAccount = useDeleteAccount();

  const cards = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (a) => a.type === "credit_card" && a.is_active
      ),
    [accounts.data]
  );

  const totals = useMemo(() => {
    const balance = cards.reduce((s, c) => s + Number(c.balance), 0);
    const limit = cards.reduce((s, c) => s + Number(c.credit_limit ?? 0), 0);
    return {
      balance,
      available: Math.max(0, limit - balance),
      utilization: calculateUtilization(balance, limit),
    };
  }, [cards]);

  const editingReminder = editing
    ? (reminders.data ?? []).find((r) => r.account_id === editing.id) ?? null
    : null;

  const isLoading = accounts.isLoading || reminders.isLoading;

  return (
    <div>
      <PageHeader
        title="Credit Cards"
        description="RBC card balances, utilization, and payment timing"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add card
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
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No credit cards"
          description="Add your RBC cards to track utilization and payment timing."
          actionLabel="Add card"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Overview */}
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total balance</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.balance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Available credit
                </p>
                <p className="text-numeric mt-1 text-2xl font-semibold text-success">
                  {formatCAD(totals.available)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Combined utilization
                </p>
                {cards.some((c) => Number(c.credit_limit ?? 0) > 0) ? (
                  <p
                    className="text-numeric mt-1 text-2xl font-semibold"
                    style={{ color: totals.utilization.color }}
                  >
                    {formatPercent(totals.utilization.percentage)}
                  </p>
                ) : (
                  <>
                    <p className="text-numeric mt-1 text-2xl font-semibold text-muted-foreground">
                      —
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Edit a card to set its credit limit
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {cards.map((card) => (
              <CardVisual
                key={card.id}
                account={card}
                onEdit={() => {
                  setEditing(card);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleting(card)}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <UtilizationTracker cards={cards} snapshots={snapshots.data ?? []} />
            <PaymentSchedule
              cards={cards}
              reminders={reminders.data ?? []}
              onSetSchedule={(card) => {
                setEditing(card);
                setModalOpen(true);
              }}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <AvionPointsCard cards={cards} />
            <div className="lg:col-span-2">
              <CardRecommender />
            </div>
          </div>
        </>
      )}

      <CardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        reminder={editingReminder}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the card, its payment schedule, and all
            transactions recorded against it.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteAccount.mutate(deleting.id);
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
