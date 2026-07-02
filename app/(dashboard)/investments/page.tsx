"use client";

import { useMemo, useState } from "react";
import { Plus, TrendingUp, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/CardSkeleton";
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
import {
  useDeleteInvestment,
  useInvestments,
} from "@/lib/hooks/useInvestments";
import {
  formatCAD,
  formatCADSigned,
  formatPercentSigned,
} from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Investment, RegisteredAccountType } from "@/types";

type TabValue = "all" | "TFSA" | "FHSA";

export default function InvestmentsPage() {
  const [tab, setTab] = useState<TabValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);

  const investments = useInvestments();
  const deleteInvestment = useDeleteInvestment();

  const all = investments.data ?? [];
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

  return (
    <div>
      <PageHeader
        title="Investments"
        description="Wealthsimple TFSA & FHSA holdings"
        actions={
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
        }
      />

      {/* Overview */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio value</p>
            <p className="text-numeric mt-1 text-2xl font-semibold">
              {formatCAD(totals.value)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unrealized gain</p>
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

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
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
    </div>
  );
}
