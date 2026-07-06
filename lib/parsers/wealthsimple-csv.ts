import Papa from "papaparse";
import type { ParsedHolding, RegisteredAccountType } from "@/types";

/**
 * Supports two Wealthsimple CSV shapes:
 *
 * 1. Real holdings report (app → account → Download holdings):
 *    Account Name,Account Type,Account Classification,Account Number,Symbol,
 *    Exchange,MIC,Name,Security Type,Quantity,Position Direction,Market Price,
 *    Market Price Currency,Book Value (CAD),…,Market Value,…,
 *    Market Unrealized Returns,…
 *
 * 2. Legacy simple export:
 *    Symbol,Security Name,Quantity,Book Value,Market Price,Market Value,
 *    Unrealized Gain/Loss
 */
export interface WealthsimpleParseResult {
  holdings: ParsedHolding[];
  errors: string[];
}

export function looksLikeWealthsimpleCsv(headerRow: string[]): boolean {
  const lower = headerRow.map((h) => h.trim().toLowerCase());
  const hasSymbol = lower.includes("symbol");
  const legacy = hasSymbol && lower.includes("security name");
  const report =
    hasSymbol &&
    lower.includes("security type") &&
    lower.some((h) => h.startsWith("book value"));
  return legacy || report;
}

const KNOWN_ETFS = new Set([
  "VFV", "XEQT", "QQC", "ZEA", "VEQT", "XGRO", "VGRO", "VUN", "XUU",
  "ZSP", "VCN", "XIC", "VDY", "ZAG", "VAB", "HXQ", "XEF", "XEC",
]);

const ACCOUNT_TYPES = new Set(["TFSA", "FHSA", "RRSP"]);

function toAccountType(raw: string): RegisteredAccountType {
  const upper = raw.trim().toUpperCase();
  return (
    ACCOUNT_TYPES.has(upper) ? upper : "Non-Registered"
  ) as RegisteredAccountType;
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[",$]/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

export function parseWealthsimpleCsv(csvText: string): WealthsimpleParseResult {
  const { data, errors: papaErrors } = Papa.parse<Record<string, string>>(
    csvText,
    { header: true, skipEmptyLines: true }
  );

  const holdings: ParsedHolding[] = [];
  // Real reports end with a quoted "As of <date>" footer — not an error.
  const errors: string[] = papaErrors
    .filter((e) => !/parsed 1$/.test(e.message))
    .map((e) => `Row ${e.row ?? "?"}: ${e.message}`);

  const isReportFormat =
    data.length > 0 && data[0]["Security Type"] !== undefined;

  data.forEach((row, i) => {
    // Skip footer/blank rows (only one populated cell).
    if (Object.values(row).filter((v) => v && v.trim()).length <= 1) return;
    const symbol = (row["Symbol"] ?? "").trim().toUpperCase();
    const name = (
      (isReportFormat ? row["Name"] : row["Security Name"]) ?? ""
    ).trim();
    const quantity = num(row["Quantity"]);
    const bookValue = num(
      isReportFormat ? row["Book Value (CAD)"] : row["Book Value"]
    );
    const marketPrice = num(row["Market Price"]);
    const marketValue = num(row["Market Value"]);
    const gain = num(
      isReportFormat
        ? row["Market Unrealized Returns"]
        : row["Unrealized Gain/Loss"]
    );

    if (!symbol || !name || quantity === null || quantity <= 0) {
      errors.push(`Row ${i + 2}: missing symbol, name, or quantity`);
      return;
    }

    const averageCost =
      bookValue !== null ? bookValue / quantity : marketPrice ?? 0;
    const gainPct =
      gain !== null && bookValue ? (gain / bookValue) * 100 : null;

    const assetType = isReportFormat
      ? (row["Security Type"] ?? "").trim().toUpperCase() ===
        "EXCHANGE_TRADED_FUND"
        ? "ETF"
        : "EQUITY"
      : KNOWN_ETFS.has(symbol)
        ? "ETF"
        : "EQUITY";

    holdings.push({
      symbol,
      name,
      quantity,
      average_cost: Math.round(averageCost * 10000) / 10000,
      current_price: marketPrice,
      market_value: marketValue,
      unrealized_gain: gain,
      unrealized_gain_pct:
        gainPct !== null ? Math.round(gainPct * 100) / 100 : null,
      asset_type: assetType,
      ...(isReportFormat && row["Account Type"]
        ? { account_type: toAccountType(row["Account Type"]) }
        : {}),
    });
  });

  return { holdings, errors };
}
