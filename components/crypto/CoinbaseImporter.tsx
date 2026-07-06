"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  looksLikeCoinbaseCsv,
  parseCoinbaseCsv,
  type ParsedCryptoHolding,
} from "@/lib/parsers/coinbase-csv";
import {
  useImportCryptoHoldings,
  useRefreshCryptoPrices,
} from "@/lib/hooks/useCrypto";
import { formatCAD } from "@/lib/utils/currency";

export function CoinbaseImporter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [holdings, setHoldings] = useState<ParsedCryptoHolding[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [fxNote, setFxNote] = useState<string | null>(null);
  const importHoldings = useImportCryptoHoldings();
  const refreshPrices = useRefreshCryptoPrices();

  function reset() {
    setHoldings([]);
    setErrors([]);
    setRowCount(0);
    setFxNote(null);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result);
      if (!looksLikeCoinbaseCsv(text)) {
        toast.error(
          "That doesn't look like a Coinbase transaction-history export."
        );
        return;
      }
      const result = parseCoinbaseCsv(text);
      if (result.holdings.length === 0) {
        toast.error(
          "No current holdings found — the transactions in this file net out to zero."
        );
        setErrors(result.errors);
        return;
      }

      let parsed = result.holdings;
      // Coinbase exports are usually priced in USD; convert costs to CAD.
      if (result.currency && result.currency !== "CAD") {
        if (result.currency !== "USD") {
          toast.error(
            `This export is priced in ${result.currency}; only USD and CAD are supported.`
          );
          return;
        }
        try {
          const res = await fetch("/api/crypto/prices?fx=USD");
          const { fx } = (await res.json()) as { fx: number | null };
          if (!res.ok || !fx) throw new Error("no rate");
          parsed = parsed.map((h) => ({
            ...h,
            average_cost_cad:
              Math.round(h.average_cost_cad * fx * 10000) / 10000,
          }));
          setFxNote(
            `Costs converted from USD at today's rate (1 USD = ${fx.toFixed(4)} CAD).`
          );
        } catch {
          toast.error(
            "Couldn't fetch the USD→CAD rate — try again in a moment."
          );
          return;
        }
      }

      setHoldings(parsed);
      setErrors(result.errors);
      setRowCount(result.rowCount);
      toast.success(
        `Parsed ${result.rowCount} transactions into ${parsed.length} holdings`
      );
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    importHoldings.mutate(holdings, {
      onSuccess: () => {
        onOpenChange(false);
        reset();
        // Pull live CAD prices for everything, including the new coins.
        refreshPrices.mutate(undefined);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Coinbase transactions</DialogTitle>
          <DialogDescription>
            On coinbase.com go to Profile → Statements → Transactions,
            choose date range “All time”, and download the CSV. Your full
            history is summed into current holdings — re-import a fresh
            export any time to update.
          </DialogDescription>
        </DialogHeader>

        {holdings.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <FileUp className="size-8" aria-hidden />
            <span className="text-sm">Click to choose a CSV file</span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {holdings.length} holding{holdings.length === 1 ? "" : "s"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                from {rowCount} transactions
              </span>
            </div>

            {fxNote && (
              <p className="text-xs text-muted-foreground">{fxNote}</p>
            )}

            {errors.length > 0 && (
              <p className="text-xs text-warning">
                {errors.slice(0, 3).join("; ")}
                {errors.length > 3 && "…"}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.symbol}>
                      <TableCell className="font-semibold">
                        {h.symbol}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-xs">
                        {h.quantity.toLocaleString("en-CA", {
                          maximumFractionDigits: 8,
                        })}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-xs">
                        {formatCAD(h.average_cost_cad)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              Existing holdings with the same symbol are updated. Live prices
              are fetched right after import.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Start over
              </Button>
              <Button
                className="flex-1"
                onClick={confirmImport}
                disabled={importHoldings.isPending}
              >
                <Upload className="size-4" aria-hidden />
                Import {holdings.length}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
