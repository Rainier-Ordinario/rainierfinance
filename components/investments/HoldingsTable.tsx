"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCAD, formatPercentSigned } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Investment } from "@/types";

type SortKey =
  | "symbol"
  | "quantity"
  | "average_cost"
  | "current_price"
  | "market_value"
  | "unrealized_gain"
  | "unrealized_gain_pct";

export function HoldingsTable({
  holdings,
  onEdit,
  onDelete,
}: {
  holdings: Investment[];
  onEdit: (holding: Investment) => void;
  onDelete: (holding: Investment) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("market_value");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...holdings];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "string"
          ? String(av).localeCompare(String(bv))
          : Number(av ?? 0) - Number(bv ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [holdings, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "symbol");
    }
  }

  function Head({ label, sort, right }: { label: string; sort?: SortKey; right?: boolean }) {
    if (!sort)
      return <TableHead className={right ? "text-right" : ""}>{label}</TableHead>;
    return (
      <TableHead className={right ? "text-right" : ""}>
        <button
          type="button"
          onClick={() => toggleSort(sort)}
          className="inline-flex items-center gap-1 hover:text-foreground"
          aria-label={`Sort by ${label}`}
        >
          {label}
          <ArrowUpDown
            className={cn("size-3", sortKey === sort ? "opacity-100" : "opacity-30")}
            aria-hidden
          />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <Head label="Symbol" sort="symbol" />
            <Head label="Name" />
            <Head label="Account" />
            <Head label="Type" />
            <Head label="Qty" sort="quantity" right />
            <Head label="Avg Cost" sort="average_cost" right />
            <Head label="Price" sort="current_price" right />
            <Head label="Value" sort="market_value" right />
            <Head label="Gain/Loss" sort="unrealized_gain" right />
            <Head label="Gain %" sort="unrealized_gain_pct" right />
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((h) => {
            const gain = Number(h.unrealized_gain ?? 0);
            return (
              <TableRow key={h.id}>
                <TableCell className="font-semibold">{h.symbol}</TableCell>
                <TableCell className="max-w-44 truncate text-muted-foreground">
                  {h.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{h.account_type ?? "—"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{h.asset_type ?? "—"}</Badge>
                </TableCell>
                <TableCell className="text-numeric text-right">
                  {Number(h.quantity).toLocaleString("en-CA", {
                    maximumFractionDigits: 4,
                  })}
                </TableCell>
                <TableCell className="text-numeric text-right">
                  {formatCAD(Number(h.average_cost))}
                </TableCell>
                <TableCell className="text-numeric text-right">
                  {h.current_price !== null
                    ? formatCAD(Number(h.current_price))
                    : "—"}
                </TableCell>
                <TableCell className="text-numeric text-right font-medium">
                  {h.market_value !== null
                    ? formatCAD(Number(h.market_value))
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-numeric text-right font-medium",
                    gain >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {h.unrealized_gain !== null ? formatCAD(gain) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-numeric text-right",
                    gain >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {h.unrealized_gain_pct !== null
                    ? formatPercentSigned(Number(h.unrealized_gain_pct))
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(h)}
                      aria-label={`Edit ${h.symbol}`}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(h)}
                      aria-label={`Delete ${h.symbol}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
