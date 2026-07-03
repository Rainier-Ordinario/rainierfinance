"use client";

import { useMemo, useState } from "react";
import { Camera, LineChart } from "lucide-react";
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
import { SnapshotModal } from "@/components/net-worth/SnapshotModal";
import { NetWorthChart } from "@/components/net-worth/NetWorthChart";
import { BreakdownCard } from "@/components/net-worth/BreakdownCard";
import { SnapshotTable } from "@/components/net-worth/SnapshotTable";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useDeleteSnapshot, useSnapshots } from "@/lib/hooks/useSnapshots";
import { netWorth, totalAssets, totalLiabilities } from "@/lib/utils/aggregate";
import { formatCAD, formatCADSigned } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { NetWorthSnapshot } from "@/types";

export default function NetWorthPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<NetWorthSnapshot | null>(null);

  const accounts = useAccounts();
  const snapshots = useSnapshots();
  const deleteSnapshot = useDeleteSnapshot();

  const active = useMemo(
    () => (accounts.data ?? []).filter((a) => a.is_active),
    [accounts.data]
  );
  const all = snapshots.data ?? [];
  const latest = all.length > 0 ? all[all.length - 1] : null;

  const current = netWorth(active);
  const changeSinceLast = latest ? current - Number(latest.net_worth) : null;

  const isLoading = accounts.isLoading || snapshots.isLoading;

  return (
    <div>
      <PageHeader
        title="Net Worth"
        description="Assets minus liabilities, tracked with monthly snapshots"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Camera className="size-4" aria-hidden />
            Log snapshot
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
          <CardSkeleton lines={6} />
        </>
      ) : active.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No accounts yet"
          description="Add your accounts first — net worth is computed from their balances."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Current net worth
                </p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(current)}
                </p>
                {changeSinceLast !== null && latest && (
                  <p
                    className={cn(
                      "text-numeric mt-1 text-xs",
                      changeSinceLast >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatCADSigned(changeSinceLast)} since{" "}
                    {formatDateShort(latest.snapshot_date)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Assets</p>
                <p className="text-numeric mt-1 text-2xl font-semibold text-success">
                  {formatCAD(totalAssets(active))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Liabilities</p>
                <p className="text-numeric mt-1 text-2xl font-semibold text-destructive">
                  {formatCAD(totalLiabilities(active))}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <NetWorthChart snapshots={all} />
            <BreakdownCard accounts={active} />
          </div>

          <div className="mt-4">
            {all.length === 0 ? (
              <EmptyState
                icon={Camera}
                title="No snapshots yet"
                description="Log your first snapshot to start tracking net worth over time."
                actionLabel="Log snapshot"
                onAction={() => setModalOpen(true)}
              />
            ) : (
              <SnapshotTable snapshots={all} onDelete={setDeleting} />
            )}
          </div>
        </>
      )}

      <SnapshotModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        accounts={active}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete snapshot from{" "}
              {deleting ? formatDateShort(deleting.snapshot_date) : ""}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteSnapshot.mutate(deleting.id);
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
