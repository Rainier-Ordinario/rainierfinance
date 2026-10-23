"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { FileUp, Loader2, Plus, Upload } from "lucide-react";
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
import {
  parseRbcCsv,
  looksLikeRbcCsv,
  rbcAccountTypeToAppType,
  type RbcDetectedAccount,
} from "@/lib/parsers/rbc-csv";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useUpsertAccount } from "@/lib/hooks/useAccounts";
import {
  applyMerchantRules,
  categorizeMerchant,
  classifyRefunds,
  knownMerchantsFrom,
} from "@/lib/utils/categorize";
import { useTransactions } from "@/lib/hooks/useTransactions";
import { useMerchantRules } from "@/lib/hooks/useMerchantRules";
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
  const merchantRules = useMerchantRules();
  const existing = useTransactions();
  // Merchants the user already pays: a credit from one of them is a refund.
  const knownMerchants = useMemo(
    () => knownMerchantsFrom(existing.data ?? []),
    [existing.data]
  );
  const [rows, setRows] = useState<ParsedCsvTransaction[]>([]);
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ColumnKey>>({});
  const [needsMapping, setNeedsMapping] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<SubscriptionCandidate[]>([]);
  const [detectedAccounts, setDetectedAccounts] = useState<
    RbcDetectedAccount[]
  >([]);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "chequing" as "chequing" | "savings" | "credit_card",
    institution: "RBC",
    last4: "",
  });

  const importTxs = useImportTransactions();
  const upsertSubscription = useUpsertSubscription();
  const upsertAccount = useUpsertAccount();

  function reset() {
    setRows([]);
    setRawGrid([]);
    setMapping({});
    setNeedsMapping(false);
    setParseErrors([]);
    setCandidates([]);
    setDetectedAccounts([]);
    setShowNewAccount(false);
    setAccountId("");
  }

  /** Prefill the new-account form from what the RBC file tells us. */
  function prefillNewAccount(detected: RbcDetectedAccount | undefined) {
    if (!detected) {
      setNewAccount({
        name: "",
        type: "chequing",
        institution: "RBC",
        last4: "",
      });
      return;
    }
    const type = rbcAccountTypeToAppType(detected.accountType);
    setNewAccount({
      name: `RBC ${detected.accountType}`,
      type,
      institution: "RBC",
      last4: detected.last4,
    });
  }

  async function createAccount() {
    if (!newAccount.name.trim()) {
      toast.error("Give the account a name");
      return;
    }
    const created = await upsertAccount.mutateAsync({
      name: newAccount.name.trim(),
      type: newAccount.type,
      institution: newAccount.institution.trim() || "RBC",
      account_number_last4: /^\d{4}$/.test(newAccount.last4)
        ? newAccount.last4
        : null,
      balance: 0,
    });
    setAccountId(created.id);
    setShowNewAccount(false);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const preview = Papa.parse<string[]>(text, { skipEmptyLines: true });
      const header = (preview.data[0] ?? []).map(String);

      if (looksLikeRbcCsv(header)) {
        const { transactions, errors, detectedAccounts: detected } =
          parseRbcCsv(text);
        setRows(
          classifyRefunds(
            applyMerchantRules(transactions, merchantRules),
            knownMerchants,
            merchantRules
          )
        );
        setParseErrors(errors);
        setDetectedAccounts(detected);
        setNeedsMapping(false);
        // Auto-match account by last-4 from the file
        const last4 = transactions.find((t) => t.accountLast4)?.accountLast4;
        const matched = accounts.find(
          (a) => a.account_number_last4 && a.account_number_last4 === last4
        );
        if (matched) {
          setAccountId(matched.id);
        } else {
          // No matching account yet — offer to create one from the file info
          prefillNewAccount(detected[0]);
          setShowNewAccount(true);
        }
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
        category: amount > 0 ? "Income" : categorizeMerchant(description, merchantRules),
        type: amount > 0 ? "income" : "expense",
      });
    });
    setRows(classifyRefunds(parsed, knownMerchants, merchantRules));
    setParseErrors(errors);
    setNeedsMapping(false);
  }

  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  function confirmImport() {
    if (!accountId) {
      toast.error("Pick which account these transactions belong to");
      return;
    }
    setImportProgress({ done: 0, total: rows.length });
    importTxs.mutate(
      {
        transactions: rows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          category: r.category,
          type: r.type,
          account_id: accountId,
        })),
        onProgress: (done, total) => setImportProgress({ done, total }),
      },
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
        onSettled: () => setImportProgress(null),
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
          setCandidates((prev) =>
            prev.filter(
              (c) => c.name !== candidate.name || c.amount !== candidate.amount
            )
          ),
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (importProgress !== null) return; // don't close mid-import
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

        {/* Importing: progress screen */}
        {importProgress !== null ? (
          <div
            className="flex flex-col items-center gap-4 py-14"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <div className="text-center">
              <p className="text-sm font-semibold">
                Importing your transactions…
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.min(importProgress.done, importProgress.total)} of{" "}
                {importProgress.total} added — keep this window open
              </p>
            </div>
            <Progress
              value={
                importProgress.total === 0
                  ? 100
                  : (Math.min(importProgress.done, importProgress.total) /
                      importProgress.total) *
                    100
              }
              className="h-2 w-64"
            />
          </div>
        ) : candidates.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm">
              These recurring charges look like subscriptions. Add them?
            </p>
            {candidates.map((c) => (
              <div
                key={`${c.name}|${c.amount}`}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">{rows.length} transactions</Badge>
              <div className="flex items-center gap-2">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-56" aria-label="Target account">
                    <SelectValue
                      placeholder={
                        accounts.length === 0
                          ? "No accounts yet"
                          : "Import into account…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        {a.account_number_last4
                          ? ` ····${a.account_number_last4}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    prefillNewAccount(detectedAccounts[0]);
                    setShowNewAccount((v) => !v);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  New account
                </Button>
              </div>
            </div>

            {detectedAccounts.length > 1 && (
              <p className="text-xs text-warning">
                This file contains {detectedAccounts.length} accounts (
                {detectedAccounts
                  .map((d) => `${d.accountType} ····${d.last4}`)
                  .join(", ")}
                ). All rows import into the single account you pick — export
                one account at a time for a clean split.
              </p>
            )}

            {showNewAccount && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  Create the account for this file
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="import-acct-name">Account name</Label>
                    <Input
                      id="import-acct-name"
                      placeholder="RBC Chequing"
                      value={newAccount.name}
                      onChange={(e) =>
                        setNewAccount((a) => ({ ...a, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-acct-type">Type</Label>
                    <Select
                      value={newAccount.type}
                      onValueChange={(v) =>
                        setNewAccount((a) => ({
                          ...a,
                          type: v as typeof newAccount.type,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="import-acct-type"
                        className="w-full"
                        aria-label="Account type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chequing">Chequing</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="credit_card">Credit card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-acct-institution">Institution</Label>
                    <Input
                      id="import-acct-institution"
                      value={newAccount.institution}
                      onChange={(e) =>
                        setNewAccount((a) => ({
                          ...a,
                          institution: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="import-acct-last4">
                      Last 4 digits (for auto-match)
                    </Label>
                    <Input
                      id="import-acct-last4"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      value={newAccount.last4}
                      onChange={(e) =>
                        setNewAccount((a) => ({
                          ...a,
                          last4: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={createAccount}
                  disabled={upsertAccount.isPending}
                >
                  {upsertAccount.isPending
                    ? "Creating…"
                    : "Create & select account"}
                </Button>
              </div>
            )}

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
