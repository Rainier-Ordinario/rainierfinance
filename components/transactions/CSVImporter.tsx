"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
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
import { parseRbcCsv, looksLikeRbcCsv } from "@/lib/parsers/rbc-csv";
import { categorizeMerchant } from "@/lib/utils/categorize";
import {
  detectSubscriptionCandidates,
  type SubscriptionCandidate,
} from "@/lib/utils/detectSubscriptions";
import { useImportTransactions } from "@/lib/hooks/useTransactions";
import { useUpsertSubscription } from "@/lib/hooks/useSubscriptions";
import { formatCAD } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import { addMonths, parseISO } from "date-fns";
import type { Account, ParsedCsvTransaction } from "@/types";

type ColumnKey = "date" | "description" | "amount" | "ignore";

export function CSVImporter({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedCsvTransaction[]>([]);
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ColumnKey>>({});
  const [needsMapping, setNeedsMapping] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<SubscriptionCandidate[]>([]);

  const importTxs = useImportTransactions();
  const upsertSubscription = useUpsertSubscription();

  function reset() {
    setRows([]);
    setRawGrid([]);
    setMapping({});
    setNeedsMapping(false);
    setParseErrors([]);
    setCandidates([]);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const preview = Papa.parse<string[]>(text, { skipEmptyLines: true });
      const header = (preview.data[0] ?? []).map(String);

      if (looksLikeRbcCsv(header)) {
        const { transactions, errors } = parseRbcCsv(text);
        setRows(transactions);
        setParseErrors(errors);
        setNeedsMapping(false);
        // Auto-match account by last-4 from the file
        const last4 = transactions.find((t) => t.accountLast4)?.accountLast4;
        const matched = accounts.find(
          (a) => a.account_number_last4 && a.account_number_last4 === last4
        );
        if (matched) setAccountId(matched.id);
        toast.success(`Detected RBC format — ${transactions.length} rows parsed`);
      } else {
        // Unknown format: show manual column mapping
        setRawGrid(preview.data.map((r) => r.map(String)));
        setNeedsMapping(true);
        const guess: Record<number, ColumnKey> = {};
        header.forEach((h, i) => {
          const lower = h.toLowerCase();
          if (lower.includes("date")) guess[i] = "date";
          else if (lower.includes("desc") || lower.includes("merchant"))
            guess[i] = "description";
          else if (lower.includes("amount") || lower.includes("cad"))
            guess[i] = "amount";
          else guess[i] = "ignore";
        });
        setMapping(guess);
      }
    };
    reader.readAsText(file);
  }

  function applyMapping() {
    const dateCol = Number(
      Object.entries(mapping).find(([, v]) => v === "date")?.[0]
    );
    const descCol = Number(
      Object.entries(mapping).find(([, v]) => v === "description")?.[0]
    );
    const amountCol = Number(
      Object.entries(mapping).find(([, v]) => v === "amount")?.[0]
    );
    if ([dateCol, descCol, amountCol].some(Number.isNaN)) {
      toast.error("Map the Date, Description, and Amount columns");
      return;
    }
    const parsed: ParsedCsvTransaction[] = [];
    const errors: string[] = [];
    rawGrid.slice(1).forEach((row, i) => {
      const rawDate = row[dateCol]?.trim() ?? "";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : parseLooseDate(rawDate);
      const description = row[descCol]?.trim() ?? "";
      const amount = Number.parseFloat(
        (row[amountCol] ?? "").replace(/[",$]/g, "")
      );
      if (!date || !description || Number.isNaN(amount)) {
        errors.push(`Row ${i + 2}: could not parse`);
        return;
      }
      parsed.push({
        date,
        description,
        amount,
        category: amount > 0 ? "Income" : categorizeMerchant(description),
        type: amount > 0 ? "income" : "expense",
      });
    });
    setRows(parsed);
    setParseErrors(errors);
    setNeedsMapping(false);
  }

  function confirmImport() {
    if (!accountId) {
      toast.error("Pick which account these transactions belong to");
      return;
    }
    importTxs.mutate(
      rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        category: r.category,
        type: r.type,
        account_id: accountId,
      })),
      {
        onSuccess: () => {
          const detected = detectSubscriptionCandidates(rows);
          if (detected.length > 0) {
            setCandidates(detected);
          } else {
            onOpenChange(false);
            reset();
          }
        },
      }
    );
  }

  function addCandidate(candidate: SubscriptionCandidate) {
    upsertSubscription.mutate(
      {
        name: candidate.name,
        amount: candidate.amount,
        billing_cycle: "monthly",
        next_billing_date: toISODate(addMonths(parseISO(candidate.lastDate), 1)),
        account_id: accountId || null,
        status: "active",
      },
      {
        onSuccess: () =>
          setCandidates((prev) => prev.filter((c) => c.name !== candidate.name)),
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
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            RBC exports are detected automatically; other files can be mapped
            manually.
          </DialogDescription>
        </DialogHeader>

        {/* Step 3: subscription candidates after import */}
        {candidates.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm">
              These recurring charges look like subscriptions. Add them?
            </p>
            {candidates.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCAD(c.amount)} · seen {c.occurrences}×
                  </p>
                </div>
                <Button size="sm" onClick={() => addCandidate(c)}>
                  Add
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        ) : rows.length === 0 && !needsMapping ? (
          /* Step 1: pick a file */
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
        ) : needsMapping ? (
          /* Step 2a: column mapping for unknown formats */
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {rawGrid[0]?.map((h, i) => (
                      <TableHead key={i} className="min-w-36">
                        <div className="space-y-1">
                          <span className="block truncate text-xs">{h}</span>
                          <Select
                            value={mapping[i] ?? "ignore"}
                            onValueChange={(v) =>
                              setMapping((m) => ({ ...m, [i]: v as ColumnKey }))
                            }
                          >
                            <SelectTrigger className="h-8" aria-label={`Map column ${h}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="description">
                                Description
                              </SelectItem>
                              <SelectItem value="amount">Amount</SelectItem>
                              <SelectItem value="ignore">Ignore</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawGrid.slice(1, 4).map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="truncate text-xs">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={applyMapping} className="w-full">
              Apply mapping
            </Button>
          </div>
        ) : (
          /* Step 2b: preview + confirm */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{rows.length} transactions</Badge>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-56" aria-label="Target account">
                  <SelectValue placeholder="Import into account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {parseErrors.length > 0 && (
              <p className="text-xs text-warning">
                {parseErrors.length} rows skipped:{" "}
                {parseErrors.slice(0, 3).join("; ")}
                {parseErrors.length > 3 && "…"}
              </p>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-numeric text-xs">
                        {r.date}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs">
                        {r.description}
                      </TableCell>
                      <TableCell className="text-xs">{r.category}</TableCell>
                      <TableCell className="text-numeric text-right text-xs">
                        {formatCAD(r.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <p className="px-3 py-2 text-center text-xs text-muted-foreground">
                  …and {rows.length - 50} more
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Start over
              </Button>
              <Button
                className="flex-1"
                onClick={confirmImport}
                disabled={importTxs.isPending}
              >
                <Upload className="size-4" aria-hidden />
                Import {rows.length}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseLooseDate(raw: string): string | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
