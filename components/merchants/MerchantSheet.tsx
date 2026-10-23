"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/lib/hooks/useTransactions";
import {
  formatCAD,
  formatCADWhole,
  formatTransactionAmount,
} from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { merchantHistory } from "@/lib/utils/spending";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-numeric text-lg font-semibold">{value}</p>
    </div>
  );
}

/**
 * One merchant's story: 12 months of spend, how often and how much per
 * visit, which categories it's been filed under, and its recent charges.
 */
export function MerchantSheet({
  merchantKey,
  onOpenChange,
}: {
  /** Normalized merchant key; null closes the sheet. */
  merchantKey: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const transactions = useTransactions();
  const history = useMemo(
    () =>
      merchantKey ? merchantHistory(transactions.data ?? [], merchantKey) : null,
    [transactions.data, merchantKey]
  );
  const searchTerm = merchantKey?.split(" ").sort((a, b) => b.length - a.length)[0];

  return (
    <Sheet open={merchantKey !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {history && (
          <>
            <SheetHeader>
              <SheetTitle>{history.name}</SheetTitle>
              <SheetDescription>
                {history.firstSeen
                  ? `First seen ${format(parseISO(history.firstSeen), "MMM yyyy")}`
                  : "No purchases yet"}
                {history.categories.length > 0 &&
                  ` · ${history.categories.map((c) => c.name).join(", ")}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Last 12 months" value={formatCADWhole(history.total)} />
                <Stat label="Visits" value={String(history.visits)} />
                <Stat label="Per visit" value={formatCAD(history.average)} />
              </div>

              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history.months} barCategoryGap={3}>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={1}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      height={18}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      formatter={(value) => [formatCAD(Number(value)), "Spent"]}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {history.months.map((m) => (
                        <Cell
                          key={m.start}
                          fill="var(--chart-1)"
                          fillOpacity={m.partial ? 0.4 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent
                </h3>
                <ul className="divide-y text-sm">
                  {history.transactions.slice(0, 10).map((t) => (
                    <li key={t.id} className="flex justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{t.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(t.date)} · {t.category}
                        </span>
                      </span>
                      <span className="text-numeric shrink-0">
                        {formatTransactionAmount(Number(t.amount), t.type)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {searchTerm && (
                <Button asChild variant="outline" className="w-full">
                  <Link
                    href={`/transactions?${new URLSearchParams({ type: "expense", search: searchTerm })}`}
                    onClick={() => onOpenChange(false)}
                  >
                    See all transactions
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
