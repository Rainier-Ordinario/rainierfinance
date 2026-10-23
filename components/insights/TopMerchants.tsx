"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { MerchantSheet } from "@/components/merchants/MerchantSheet";
import { formatCAD, formatCADWhole } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import {
  PERIOD_LABELS,
  periodLabel,
  periodRange,
  topMerchants,
  type SpendingPeriod,
} from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

type SortBy = "total" | "visits";

const INITIAL_VISIBLE = 12;

/**
 * Where spending concentrates by merchant. Sorting by visits surfaces habits
 * (the daily coffee) that a sort by dollars hides behind big one-offs.
 */
export function TopMerchants({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [period, setPeriod] = useState<SpendingPeriod>("3_months");
  const [sortBy, setSortBy] = useState<SortBy>("total");
  const [showAll, setShowAll] = useState(false);

  const { label, merchants, periodTotal } = useMemo(() => {
    const { from, to, months } = periodRange(period);
    const merchants = topMerchants(transactions, toISODate(from), toISODate(to));
    return {
      label: periodLabel(from, to, months),
      merchants,
      periodTotal: merchants.reduce((s, m) => s + m.total, 0),
    };
  }, [transactions, period]);

  const sorted = useMemo(
    () =>
      sortBy === "visits"
        ? [...merchants].sort((a, b) => b.visits - a.visits || b.total - a.total)
        : merchants,
    [merchants, sortBy]
  );
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const maxTotal = merchants[0]?.total ?? 0;


  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Top merchants</CardTitle>
          <CardDescription>
            {label} · {merchants.length} merchants, {formatCADWhole(periodTotal)}{" "}
            total
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <TabsList>
              <TabsTrigger value="total">Most spent</TabsTrigger>
              <TabsTrigger value="visits">Most visits</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as SpendingPeriod);
              setShowAll(false);
            }}
          >
            <SelectTrigger size="sm" className="w-32" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as SpendingPeriod[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No spending in this period.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Avg / visit</TableHead>
                    <TableHead className="w-[30%] text-right">Total</TableHead>
                    <TableHead className="text-right">Last</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((m) => (
                    <TableRow
                      key={m.key}
                      className="cursor-pointer"
                      onClick={() => setOpenKey(m.key)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenKey(m.key);
                          }}
                          className="flex min-w-0 items-center gap-2 text-left focus-visible:underline focus-visible:outline-none"
                          aria-label={`See ${m.name} history`}
                        >
                          <CategoryIcon
                            category={m.category}
                            categories={categories}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {m.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {m.category}
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right text-numeric">
                        {m.visits}
                      </TableCell>
                      <TableCell className="text-right text-numeric text-muted-foreground">
                        {formatCAD(m.average)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:block"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-chart-1"
                              style={{
                                width: `${maxTotal > 0 ? (m.total / maxTotal) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-numeric font-medium">
                            {formatCAD(m.total)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(parseISO(m.lastDate), "MMM d")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sorted.length > INITIAL_VISIBLE && (
              <div className="mt-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Show fewer" : `Show all ${sorted.length}`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
      <MerchantSheet
        merchantKey={openKey}
        onOpenChange={(o) => !o && setOpenKey(null)}
      />
    </Card>
  );
}
