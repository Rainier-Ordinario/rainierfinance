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

    transactions.push({
      date,
      description,
      amount,
      category: amount > 0 ? "Income" : categorizeMerchant(description),
      type: amount > 0 ? "income" : "expense",
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
