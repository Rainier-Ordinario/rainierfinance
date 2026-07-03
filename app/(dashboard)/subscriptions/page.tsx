"use client";

import { useMemo, useState } from "react";
import { Plus, Repeat } from "lucide-react";
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
import { SubscriptionCard } from "@/components/subscriptions/SubscriptionCard";
import { SubscriptionModal } from "@/components/subscriptions/SubscriptionModal";
import { DetectedSubscriptions } from "@/components/subscriptions/DetectedSubscriptions";
import {
  useDeleteSubscription,
  useSubscriptions,
} from "@/lib/hooks/useSubscriptions";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { formatCAD } from "@/lib/utils/currency";
import {
  detectRecurringCharges,
  monthlyAmount,
} from "@/lib/utils/subscriptions";
import type { Subscription } from "@/types";

export default function SubscriptionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);

  const subscriptions = useSubscriptions();
  const accounts = useAccounts();
  const transactions = useTransactions();
  const deleteSubscription = useDeleteSubscription();

  const subs = useMemo(() => subscriptions.data ?? [], [subscriptions.data]);
  const active = useMemo(
    () => subs.filter((s) => s.status === "active"),
    [subs]
  );

  const totals = useMemo(() => {
    const monthly = active.reduce((s, sub) => s + monthlyAmount(sub), 0);
    return { monthly, yearly: monthly * 12 };
  }, [active]);

  const detected = useMemo(
    () => detectRecurringCharges(transactions.data ?? [], subs),
    [transactions.data, subs]
  );

  const isLoading = subscriptions.isLoading || accounts.isLoading;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Recurring charges and renewal dates"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add subscription
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
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={2} />
          </div>
        </>
      ) : subs.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No subscriptions"
          description="Track your recurring charges to see what they add up to each month."
          actionLabel="Add subscription"
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
                <p className="text-sm text-muted-foreground">Monthly total</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.monthly)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Yearly total</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.yearly)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {active.length}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    of {subs.length}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                accounts={accounts.data ?? []}
                onEdit={() => {
                  setEditing(sub);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleting(sub)}
              />
            ))}
          </div>

          <div className="mt-4">
            <DetectedSubscriptions detected={detected} />
          </div>
        </>
      )}

      <SubscriptionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        accounts={accounts.data ?? []}
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
                if (deleting) deleteSubscription.mutate(deleting.id);
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
