import Papa from "papaparse";
import { parse as parseDate, isValid } from "date-fns";
import { categorizeMerchant } from "@/lib/utils/categorize";
import { toISODate } from "@/lib/utils/dates";
import type { ParsedCsvTransaction } from "@/types";

/**
 * RBC export format:
 * Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$
 * Visa,XXXX1234,7/1/2026,,WHOLEFDS #1234,,"-82.43",
 */
export interface RbcDetectedAccount {
  last4: string;
  /** Raw RBC "Account Type" value, e.g. "Visa", "Chequing", "Savings". */
  accountType: string;
}

export interface RbcParseResult {
  transactions: ParsedCsvTransaction[];
  errors: string[];
  /** Unique accounts found in the file (RBC exports can bundle several). */
  detectedAccounts: RbcDetectedAccount[];
}

const RBC_HEADERS = ["Account Type", "Account Number", "Transaction Date"];

/** RBC's bilingual credit-card payment descriptions. */
const CC_PAYMENT_RE =
  /payment\s*-\s*thank you|paiement\s*-\s*merci|payment received/i;

/**
 * RBC wordings for moving money between your own accounts. Counting these
 * as income/expenses double-counts every internal transfer.
 */
const INTERNAL_TRANSFER_RE =
  /^online banking transfer|^online transfer (to|from) deposit account|^www transfer/i;

/** Funding your own investment/crypto accounts — outflow, but not spending. */
const INVESTMENT_FUNDING_RE =
  /e-transfer request fulfilled coinbase|wealthsimple invest/i;

/**
 * Whether an RBC description moves money between the user's own accounts:
 * "transfer" for card payments and internal moves, "investment" for funding
 * investment/crypto accounts, null for real income or spending.
 */
export function rbcTransferKind(
  description: string
): "transfer" | "investment" | null {
  if (CC_PAYMENT_RE.test(description) || INTERNAL_TRANSFER_RE.test(description))
    return "transfer";
  if (INVESTMENT_FUNDING_RE.test(description)) return "investment";
  return null;
}

export function looksLikeRbcCsv(headerRow: string[]): boolean {
  return RBC_HEADERS.every((h) =>
    headerRow.some((col) => col.trim().toLowerCase() === h.toLowerCase())
  );
}

function parseRbcDate(raw: string): string | null {
  const trimmed = raw.trim();
  // RBC uses M/D/YYYY
  for (const fmt of ["M/d/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]) {
    const parsed = parseDate(trimmed, fmt, new Date());
    if (isValid(parsed)) return toISODate(parsed);
  }
  return null;
}

export function parseRbcCsv(csvText: string): RbcParseResult {
  const { data, errors: papaErrors } = Papa.parse<Record<string, string>>(
    csvText,
    { header: true, skipEmptyLines: true }
  );

  const transactions: ParsedCsvTransaction[] = [];
  const errors: string[] = papaErrors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );
  const detectedMap = new Map<string, RbcDetectedAccount>();

  data.forEach((row, i) => {
    const rawDate = row["Transaction Date"] ?? "";
    const date = parseRbcDate(rawDate);
    if (!date) {
      errors.push(`Row ${i + 2}: unrecognized date "${rawDate}"`);
      return;
    }

    const description = [row["Description 1"], row["Description 2"]]
      .filter((d) => d && d.trim())
      .join(" ")
      .trim();

    const rawAmount = (row["CAD$"] ?? "").replace(/[",$]/g, "").trim();
    const amount = Number.parseFloat(rawAmount);
    if (!description || Number.isNaN(amount)) {
      errors.push(`Row ${i + 2}: missing description or amount`);
      return;
    }

    const last4 = (row["Account Number"] ?? "").replace(/\D/g, "").slice(-4);
    if (last4 && !detectedMap.has(last4)) {
      detectedMap.set(last4, {
        last4,
        accountType: (row["Account Type"] ?? "").trim(),
      });
    }

    // Money moving between the user's own accounts (card payments,
    // chequing<->savings, funding investment accounts) must be transfers —
    // typing them income/expense double-counts every internal move.
    const transferKind = rbcTransferKind(description);
    const isTransfer = transferKind === "transfer";
    const isInvestmentFunding = transferKind === "investment";

    transactions.push({
      date,
      description,
      amount,
      category: isTransfer
        ? "Transfer"
        : isInvestmentFunding
          ? "Investments"
          : amount > 0
            ? "Income"
            : categorizeMerchant(description),
      type:
        isTransfer || isInvestmentFunding
          ? "transfer"
          : amount > 0
            ? "income"
            : "expense",
      accountLast4: last4 || undefined,
    });
  });

  return { transactions, errors, detectedAccounts: [...detectedMap.values()] };
}

/** Map RBC's "Account Type" column to our account type enum. */
export function rbcAccountTypeToAppType(
  raw: string
): "chequing" | "savings" | "credit_card" {
  const lower = raw.toLowerCase();
  if (lower.includes("visa") || lower.includes("mastercard")) {
    return "credit_card";
  }
  if (lower.includes("sav")) return "savings";
  return "chequing";
}

export interface RbcAccountGroup {
  last4: string;
  /** Raw RBC "Account Type", e.g. "Visa". */
  accountType: string;
  rows: ParsedCsvTransaction[];
  /** The existing account with these last 4 digits, or null to create one. */
  accountId: string | null;
  /** Name and type for the account to create when accountId is null. */
  newName: string;
  newType: "chequing" | "savings" | "credit_card";
}

/**
 * Split RBC rows by account number and match each account to an existing
 * one by its last 4 digits, so a single all-accounts export imports in one
 * go. Rows without an account number go in a group with last4 "".
 */
export function groupRbcRowsByAccount(
  rows: ParsedCsvTransaction[],
  detected: RbcDetectedAccount[],
  accounts: { id: string; account_number_last4: string | null; is_active?: boolean }[]
): RbcAccountGroup[] {
  const groups = new Map<string, RbcAccountGroup>();
  for (const row of rows) {
    const last4 = row.accountLast4 ?? "";
    let group = groups.get(last4);
    if (!group) {
      const accountType = detected.find((d) => d.last4 === last4)?.accountType ?? "";
      const match = last4
        ? accounts.find((a) => a.account_number_last4 === last4)
        : undefined;
      group = {
        last4,
        accountType,
        rows: [],
        accountId: match?.id ?? null,
        newName: `RBC ${accountType || "Account"}`.trim(),
        newType: rbcAccountTypeToAppType(accountType),
      };
      groups.set(last4, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}
