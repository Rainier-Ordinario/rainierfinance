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
  groupRbcRowsByAccount,
  parseRbcCsv,
  looksLikeRbcCsv,
  type RbcAccountGroup,
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
import { cn } from "@/lib/utils";
import { toISODate } from "@/lib/utils/dates";
import { addMonths, parseISO } from "date-fns";
import type { Account, ParsedCsvTransaction } from "@/types";

type ColumnKey = "date" | "description" | "amount" | "ignore";

/** A detected subscription and the account its charges came from. */
type Candidate = SubscriptionCandidate & { accountId: string | null };

const TYPE_LABELS = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
} as const;

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
  // RBC files: rows split by account, each matched or to be created.
  const [groups, setGroups] = useState<RbcAccountGroup[]>([]);
  const [dragging, setDragging] = useState(false);
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ColumnKey>>({});
  const [needsMapping, setNeedsMapping] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
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
    setGroups([]);
    setRawGrid([]);
    setMapping({});
    setNeedsMapping(false);
    setParseErrors([]);
    setCandidates([]);
    setShowNewAccount(false);
    setAccountId("");
  }

  function resetNewAccount() {
    setNewAccount({ name: "", type: "chequing", institution: "RBC", last4: "" });
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

  /**
   * RBC exports, one or several, and with one account or all of them, go
   * straight to a per-account summary. Any other single file gets the
   * column-mapping step.
   */
  async function handleFiles(files: File[]) {
    const csvs = files.filter(
      (f) => f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv"
    );
    if (csvs.length === 0) {
      toast.error("Choose a .csv file");
      return;
    }
    const texts = await Promise.all(csvs.map((f) => f.text()));
    const headers = texts.map((text) =>
      (Papa.parse<string[]>(text, { skipEmptyLines: true, preview: 1 }).data[0] ?? []).map(String)
    );

    if (headers.every(looksLikeRbcCsv)) {
      const transactions: ParsedCsvTransaction[] = [];
      const detected: RbcDetectedAccount[] = [];
      const errors: string[] = [];
      texts.forEach((text, i) => {
        const parsed = parseRbcCsv(text);
        transactions.push(...parsed.transactions);
        for (const d of parsed.detectedAccounts) {
          if (!detected.some((x) => x.last4 === d.last4)) detected.push(d);
        }
        errors.push(
          ...parsed.errors.map((e) => (csvs.length > 1 ? `${csvs[i].name} ${e}` : e))
        );
      });
      const classified = classifyRefunds(
        applyMerchantRules(transactions, merchantRules),
        knownMerchants,
        merchantRules
      );
      const split = groupRbcRowsByAccount(classified, detected, accounts);
      setGroups(split);
      setRows(classified);
      setParseErrors(errors);
      setNeedsMapping(false);
      return;
    }

    if (csvs.length > 1) {
      toast.error(
        "Only RBC exports can be imported together — add other files one at a time."
      );
      return;
    }

    // Unknown format: show manual column mapping
    const preview = Papa.parse<string[]>(texts[0], { skipEmptyLines: true });
    const header = headers[0];
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

  function runImport(
    transactions: Parameters<typeof importTxs.mutate>[0]["transactions"],
    detect: () => Candidate[]
  ) {
    setImportProgress({ done: 0, total: transactions.length });
    importTxs.mutate(
      {
        transactions,
        onProgress: (done, total) => setImportProgress({ done, total }),
      },
      {
        onSuccess: () => {
          const detected = detect();
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

  /** RBC: create any accounts that don't exist yet, then import every group at once. */
  async function confirmRbcImport() {
    if (groups.some((g) => !g.accountId && !g.newName.trim())) {
      toast.error("Give each new account a name");
      return;
    }
    const resolved: RbcAccountGroup[] = [];
    try {
      for (const g of groups) {
        if (g.accountId) {
          resolved.push(g);
          continue;
        }
        const created = await upsertAccount.mutateAsync({
          name: g.newName.trim(),
          type: g.newType,
          institution: "RBC",
          account_number_last4: /^\d{4}$/.test(g.last4) ? g.last4 : null,
          balance: 0,
        });
        resolved.push({ ...g, accountId: created.id });
      }
    } catch {
      return; // the hook already showed the error
    }
    setGroups(resolved);
    runImport(
      resolved.flatMap((g) =>
        g.rows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          category: r.category,
          type: r.type,
          account_id: g.accountId!,
        }))
      ),
      () =>
        resolved.flatMap((g) =>
          detectSubscriptionCandidates(g.rows).map((c) => ({
            ...c,
            accountId: g.accountId,
          }))
        )
    );
  }

  function confirmImport() {
    if (!accountId) {
      toast.error("Pick which account these transactions belong to");
      return;
    }
    runImport(
      rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        category: r.category,
        type: r.type,
        account_id: accountId,
      })),
      () =>
        detectSubscriptionCandidates(rows).map((c) => ({ ...c, accountId }))
    );
  }

  function addCandidate(candidate: Candidate) {
    upsertSubscription.mutate(
      {
        name: candidate.name,
        amount: candidate.amount,
        billing_cycle: "monthly",
        next_billing_date: toISODate(addMonths(parseISO(candidate.lastDate), 1)),
        account_id: candidate.accountId,
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

  /** Skipped-row note, a preview of the rows, and the import buttons. */
  function renderPreview(onConfirm: () => void) {
    return (
      <>
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
                onClick={onConfirm}
                disabled={importTxs.isPending || upsertAccount.isPending}
              >
                <Upload className="size-4" aria-hidden />
                Import {rows.length}
              </Button>
            </div>
      </>
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
            Drop in RBC exports — one account or all of them — and each row
            lands in the right account. Other files can be mapped manually.
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
          /* Step 1: pick or drop files */
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles([...e.dataTransfer.files]);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
              dragging && "border-primary bg-primary/5 text-foreground"
            )}
          >
            <FileUp className="size-8" aria-hidden />
            <span className="text-sm">Drop CSV files here, or click to choose</span>
            <span className="text-xs">
              Tip: in RBC Online Banking, download &ldquo;All accounts&rdquo; as one CSV
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                if (files.length > 0) handleFiles(files);
                e.target.value = "";
              }}
            />
          </button>
        ) : groups.length > 0 ? (
          /* RBC: one line per account, matched by its last 4 digits */
          <div className="space-y-4">
            <p className="text-sm">
              {rows.length} transactions across {groups.length}{" "}
              {groups.length === 1 ? "account" : "accounts"}. Rows you&apos;ve
              already imported are skipped.
            </p>
            <ul className="divide-y rounded-lg border">
              {groups.map((g, i) => {
                const existing = accounts.find((a) => a.id === g.accountId);
                const dates = g.rows.map((r) => r.date).sort();
                return (
                  <li
                    key={g.last4 || i}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      {existing ? (
                        <p className="truncate text-sm font-medium">
                          {existing.name}
                        </p>
                      ) : (
                        <Input
                          aria-label={`Name for new account ····${g.last4}`}
                          value={g.newName}
                          className="h-8 max-w-64"
                          onChange={(e) =>
                            setGroups((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, newName: e.target.value } : x
                              )
                            )
                          }
                        />
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.last4 ? `····${g.last4} · ` : ""}
                        {dates[0]} → {dates[dates.length - 1]}
                      </p>
                    </div>
                    {!existing && (
                      <Badge variant="outline">
                        New {TYPE_LABELS[g.newType].toLowerCase()} account
                      </Badge>
                    )}
                    <span className="text-numeric w-16 text-right text-sm">
                      {g.rows.length} rows
                    </span>
                  </li>
                );
              })}
            </ul>
            {renderPreview(confirmRbcImport)}
          </div>
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
                    resetNewAccount();
                    setShowNewAccount((v) => !v);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  New account
                </Button>
              </div>
            </div>

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

            {renderPreview(confirmImport)}
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
