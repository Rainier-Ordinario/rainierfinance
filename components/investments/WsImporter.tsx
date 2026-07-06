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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseWealthsimpleCsv } from "@/lib/parsers/wealthsimple-csv";
import { useImportInvestments } from "@/lib/hooks/useInvestments";
import { formatCAD } from "@/lib/utils/currency";
import type { ParsedHolding, RegisteredAccountType } from "@/types";

export function WsImporter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [holdings, setHoldings] = useState<ParsedHolding[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [accountType, setAccountType] =
    useState<RegisteredAccountType>("TFSA");
  const importInvestments = useImportInvestments();

  function reset() {
    setHoldings([]);
    setErrors([]);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const { holdings: parsed, errors: parseErrors } = parseWealthsimpleCsv(
        String(reader.result)
      );
      if (parsed.length === 0) {
        toast.error(
          "Couldn't find any holdings — is this a Wealthsimple holdings export?"
        );
        return;
      }
      setHoldings(parsed);
      setErrors(parseErrors);
    };
    reader.readAsText(file);
  }

  // Real Wealthsimple reports name the account per row — no dropdown needed.
  const detectedTypes = [
    ...new Set(
      holdings
        .map((h) => h.account_type)
        .filter((t): t is RegisteredAccountType => t !== undefined)
    ),
  ];
  const autoDetected = detectedTypes.length > 0;

  function confirmImport() {
    const rows = autoDetected
      ? holdings.map((h) => ({
          ...h,
          account_type: h.account_type as RegisteredAccountType,
        }))
      : holdings.map((h) => ({ ...h, account_type: accountType }));
    importInvestments.mutate(
      {
        investments: rows,
        replaceAccountTypes: autoDetected ? detectedTypes : [accountType],
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Wealthsimple holdings</DialogTitle>
          <DialogDescription>
            Upload the holdings CSV exported from Wealthsimple.
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">{holdings.length} holdings</Badge>
              {autoDetected ? (
                <div className="flex items-center gap-1.5">
                  {detectedTypes.map((t) => (
                    <Badge key={t} variant="outline">
                      {t} ·{" "}
                      {holdings.filter((h) => h.account_type === t).length}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Select
                  value={accountType}
                  onValueChange={(v) =>
                    setAccountType(v as RegisteredAccountType)
                  }
                >
                  <SelectTrigger className="w-44" aria-label="Account type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["TFSA", "FHSA", "RRSP", "Non-Registered"] as const).map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {autoDetected && (
              <p className="text-xs text-muted-foreground">
                Account detected from the file. Importing replaces your
                existing {detectedTypes.join(" and ")} holdings with this
                snapshot.
              </p>
            )}

            {errors.length > 0 && (
              <p className="text-xs text-warning">
                {errors.length} rows skipped: {errors.slice(0, 3).join("; ")}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.symbol}>
                      <TableCell className="font-semibold">
                        {h.symbol}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs">
                        {h.name}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-xs">
                        {h.quantity}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-xs">
                        {h.market_value !== null
                          ? formatCAD(h.market_value)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Start over
              </Button>
              <Button
                className="flex-1"
                onClick={confirmImport}
                disabled={importInvestments.isPending}
              >
                <Upload className="size-4" aria-hidden />
                Import into{" "}
                {autoDetected ? detectedTypes.join(" + ") : accountType}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
