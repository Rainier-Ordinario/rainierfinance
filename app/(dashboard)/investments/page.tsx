"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, TrendingUp, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  StatCardSkeleton,
  TableSkeleton,
} from "@/components/shared/CardSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HoldingsTable } from "@/components/investments/HoldingsTable";
import {
  AllocationBySymbol,
  EtfVsEquity,
  GeographicExposure,
  PerformanceChart,
} from "@/components/investments/AllocationChart";
import { PortfolioHealth } from "@/components/investments/PortfolioHealth";
import { InvestmentModal } from "@/components/investments/InvestmentModal";
import { WsImporter } from "@/components/investments/WsImporter";
import { CryptoSection } from "@/components/crypto/CryptoSection";
import {
  useDeleteInvestment,
  useInvestments,
} from "@/lib/hooks/useInvestments";
import { useCryptoHoldings } from "@/lib/hooks/useCrypto";
import {
  formatCAD,
  formatCADSigned,
  formatPercentSigned,
} from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Investment, RegisteredAccountType } from "@/types";

type MainTab = "stocks" | "crypto";
type AccountTab = "all" | "TFSA" | "FHSA";

function InvestmentsContent() {
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<MainTab>(
    searchParams.get("tab") === "crypto" ? "crypto" : "stocks"
  );
  const [tab, setTab] = useState<AccountTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);

  const investments = useInvestments();
  const crypto = useCryptoHoldings();
  const deleteInvestment = useDeleteInvestment();

  const all = useMemo(() => investments.data ?? [], [investments.data]);
  const visible = useMemo(
    () => (tab === "all" ? all : all.filter((h) => h.account_type === tab)),
    [all, tab]
  );

  const totals = useMemo(() => {
    const value = visible.reduce((s, h) => s + Number(h.market_value ?? 0), 0);
    const gain = visible.reduce(
      (s, h) => s + Number(h.unrealized_gain ?? 0),
      0
    );
    const book = value - gain;
    return {
      value,
      gain,
      gainPct: book > 0 ? (gain / book) * 100 : 0,
    };
  }, [visible]);

  const combined = useMemo(() => {
    const stocks = all.reduce((s, h) => s + Number(h.market_value ?? 0), 0);
    const coins = (crypto.data ?? []).reduce(
      (s, h) => s + Number(h.market_value_cad ?? 0),
      0
    );
    return { stocks, coins, total: stocks + coins };
  }, [all, crypto.data]);

  return (
    <div>
      <PageHeader
        title="Investments"
        description="Stocks, ETFs, and crypto in one place"
        actions={
          mainTab === "stocks" ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" aria-hidden />
                Import CSV
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
          ) : undefined
        }
      />

      {/* Combined portfolio strip */}
      {investments.isLoading || crypto.isLoading ? (
        <div className="mb-4">
          <StatCardSkeleton />
        </div>
      ) : (
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-baseline gap-x-8 gap-y-2 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Total portfolio</p>
            <p className="text-numeric mt-1 text-2xl font-semibold">
              {formatCAD(combined.total)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Stocks &amp; ETFs</p>
            <p className="text-numeric mt-1 text-lg font-medium">
              {formatCAD(combined.stocks)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Crypto</p>
            <p className="text-numeric mt-1 text-lg font-medium">
              {formatCAD(combined.coins)}
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as MainTab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="stocks">Stocks &amp; ETFs</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
        </TabsList>
      </Tabs>

      {mainTab === "crypto" ? (
        <CryptoSection />
      ) : (
        <>
          {/* Overview */}
          {investments.isLoading ? (
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Portfolio value
                </p>
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
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as AccountTab)}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="TFSA">TFSA</TabsTrigger>
              <TabsTrigger value="FHSA">FHSA</TabsTrigger>
            </TabsList>
          </Tabs>

          {investments.isLoading ? (
            <TableSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No holdings"
              description="Import your Wealthsimple holdings CSV or add one manually."
              actionLabel="Import CSV"
              onAction={() => setImportOpen(true)}
            />
          ) : (
            <>
              <HoldingsTable
                holdings={visible}
                onEdit={(h) => {
                  setEditing(h);
                  setModalOpen(true);
                }}
                onDelete={setDeleting}
              />

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <AllocationBySymbol holdings={visible} />
                <GeographicExposure holdings={visible} />
                <EtfVsEquity holdings={visible} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <PerformanceChart holdings={visible} />
                <PortfolioHealth holdings={visible} />
              </div>
            </>
          )}

          <InvestmentModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            editing={editing}
            defaultAccountType={
              tab === "all" ? "TFSA" : (tab as RegisteredAccountType)
            }
          />
          <WsImporter open={importOpen} onOpenChange={setImportOpen} />

          <AlertDialog
            open={deleting !== null}
            onOpenChange={(o) => !o && setDeleting(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deleting?.symbol}?</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleting) deleteInvestment.mutate(deleting.id);
                    setDeleting(null);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

export default function InvestmentsPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentsContent />
    </Suspense>
  );
}
