"use client";

import { useMemo, useState } from "react";
import { Bitcoin, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  StatCardSkeleton,
  TableSkeleton,
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
import { CryptoTable } from "@/components/crypto/CryptoTable";
import { CryptoModal } from "@/components/crypto/CryptoModal";
import {
  useCryptoHoldings,
  useDeleteCryptoHolding,
  useRefreshCryptoPrices,
} from "@/lib/hooks/useCrypto";
import {
  formatCAD,
  formatCADSigned,
  formatPercentSigned,
} from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CryptoHolding } from "@/types";

export default function CryptoPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CryptoHolding | null>(null);
  const [deleting, setDeleting] = useState<CryptoHolding | null>(null);

  const holdings = useCryptoHoldings();
  const deleteHolding = useDeleteCryptoHolding();
  const refreshPrices = useRefreshCryptoPrices();

  const all = useMemo(() => holdings.data ?? [], [holdings.data]);

  const totals = useMemo(() => {
    const value = all.reduce((s, h) => s + Number(h.market_value_cad ?? 0), 0);
    const gain = all.reduce(
      (s, h) => s + Number(h.unrealized_gain_cad ?? 0),
      0
    );
    const book = value - gain;
    return { value, gain, gainPct: book > 0 ? (gain / book) * 100 : 0 };
  }, [all]);

  const lastUpdated = useMemo(() => {
    const stamps = all
      .map((h) => (h.last_updated ? new Date(h.last_updated).getTime() : 0))
      .filter((t) => t > 0);
    if (stamps.length === 0) return null;
    return new Date(Math.max(...stamps));
  }, [all]);

  return (
    <div>
      <PageHeader
        title="Crypto"
        description={
          lastUpdated
            ? `Holdings in CAD · prices as of ${lastUpdated.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`
            : "Holdings in CAD"
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => refreshPrices.mutate(all)}
              disabled={refreshPrices.isPending || all.length === 0}
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  refreshPrices.isPending && "animate-spin"
                )}
                aria-hidden
              />
              {refreshPrices.isPending ? "Refreshing…" : "Refresh prices"}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add holding
            </Button>
          </>
        }
      />

      {holdings.isLoading ? (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <TableSkeleton rows={4} />
        </>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Bitcoin}
          title="No crypto holdings"
          description="Add your coins to track their value in CAD with live Coinbase prices."
          actionLabel="Add holding"
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
                <p className="text-sm text-muted-foreground">Total value</p>
                <p className="text-numeric mt-1 text-2xl font-semibold">
                  {formatCAD(totals.value)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Unrealized gain
                </p>
                <p
                  className={cn(
                    "text-numeric mt-1 text-2xl font-semibold",
                    totals.gain >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {formatCADSigned(totals.gain)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Return</p>
                <p
                  className={cn(
                    "text-numeric mt-1 text-2xl font-semibold",
                    totals.gainPct >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {formatPercentSigned(totals.gainPct)}
                </p>
              </CardContent>
            </Card>
          </div>

          <CryptoTable
            holdings={all}
            onEdit={(h) => {
              setEditing(h);
              setModalOpen(true);
            }}
            onDelete={setDeleting}
          />
        </>
      )}

      <CryptoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.symbol}?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the holding from your portfolio. Your exchange
            account is not affected.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteHolding.mutate(deleting.id);
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
