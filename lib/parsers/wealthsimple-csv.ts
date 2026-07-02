import Papa from "papaparse";
import type { ParsedHolding } from "@/types";

/**
 * Wealthsimple holdings export format:
 * Symbol,Security Name,Quantity,Book Value,Market Price,Market Value,Unrealized Gain/Loss
 * VFV,Vanguard S&P 500 ETF,46.8654,7820.56,186.05,8719.31,898.75
 */
export interface WealthsimpleParseResult {
  holdings: ParsedHolding[];
  errors: string[];
}

export function looksLikeWealthsimpleCsv(headerRow: string[]): boolean {
  const lower = headerRow.map((h) => h.trim().toLowerCase());
  return lower.includes("symbol") && lower.includes("security name");
}

const KNOWN_ETFS = new Set([
  "VFV", "XEQT", "QQC", "ZEA", "VEQT", "XGRO", "VGRO", "VUN", "XUU",
  "ZSP", "VCN", "XIC", "VDY", "ZAG", "VAB", "HXQ", "XEF", "XEC",
]);

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
  const errors: string[] = papaErrors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );

  data.forEach((row, i) => {
    const symbol = (row["Symbol"] ?? "").trim().toUpperCase();
    const name = (row["Security Name"] ?? "").trim();
    const quantity = num(row["Quantity"]);
    const bookValue = num(row["Book Value"]);
    const marketPrice = num(row["Market Price"]);
    const marketValue = num(row["Market Value"]);
    const gain = num(row["Unrealized Gain/Loss"]);

    if (!symbol || !name || quantity === null || quantity <= 0) {
      errors.push(`Row ${i + 2}: missing symbol, name, or quantity`);
      return;
    }

    const averageCost =
      bookValue !== null ? bookValue / quantity : marketPrice ?? 0;
    const gainPct =
      gain !== null && bookValue ? (gain / bookValue) * 100 : null;

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
      asset_type: KNOWN_ETFS.has(symbol) ? "ETF" : "EQUITY",
    });
  });

  return { holdings, errors };
}
