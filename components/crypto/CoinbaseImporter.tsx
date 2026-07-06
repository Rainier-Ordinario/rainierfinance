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
  const importHoldings = useImportCryptoHoldings();
  const refreshPrices = useRefreshCryptoPrices();

  function reset() {
    setHoldings([]);
    setErrors([]);
    setRowCount(0);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
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
      setHoldings(result.holdings);
      setErrors(result.errors);
      setRowCount(result.rowCount);
      toast.success(
        `Parsed ${result.rowCount} transactions into ${result.holdings.length} holdings`
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
            Upload the transaction-history CSV from Coinbase (Statements →
            Generate report). Your full history is summed into current
            holdings.
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
