import Papa from "papaparse";

/**
 * Coinbase transaction-history export (coinbase.com → Statements →
 * Transaction history CSV). The file starts with a few preamble lines, then:
 *
 *   (ID,)?Timestamp,Transaction Type,Asset,Quantity Transacted,
 *   (Spot )?Price Currency,(Spot )?Price at Transaction,Subtotal,
 *   Total (inclusive of fees and/or spread),Fees and/or Spread,Notes
 *
 * We aggregate the full history into current holdings using average-cost
 * accounting, which matches the crypto_holdings model (quantity + avg cost).
 */
export interface ParsedCryptoHolding {
  symbol: string;
  name: string;
  quantity: number;
  average_cost_cad: number;
}

export interface CoinbaseParseResult {
  holdings: ParsedCryptoHolding[];
  errors: string[];
  rowCount: number;
}

const ACQUIRE_RE =
  /^(buy|advanced? trade buy|receive|.*(income|reward)s?)$/i;
const DISPOSE_RE = /^(sell|advanced? trade sell|send|withdrawal)$/i;
const CONVERT_RE = /^convert/i;
/** e.g. "Converted 0.00500000 BTC to 0.15000000 ETH" */
const CONVERT_NOTES_RE =
  /converted\s+[\d,.]+\s+\S+\s+to\s+([\d,.]+)\s+([A-Z0-9]+)/i;

export function looksLikeCoinbaseCsv(csvText: string): boolean {
  const head = csvText.slice(0, 2000).toLowerCase();
  return head.includes("transaction type") && head.includes("quantity transacted");
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[",$]/g, "").trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

export function parseCoinbaseCsv(csvText: string): CoinbaseParseResult {
  // Skip the preamble: find the real header line.
  const lines = csvText.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (l) => l.includes("Transaction Type") && l.includes("Quantity Transacted")
  );
  if (headerIndex === -1) {
    return {
      holdings: [],
      errors: ["Couldn't find the Coinbase header row in this file."],
      rowCount: 0,
    };
  }

  const { data, errors: papaErrors } = Papa.parse<Record<string, string>>(
    lines.slice(headerIndex).join("\n"),
    { header: true, skipEmptyLines: true }
  );

  const errors: string[] = papaErrors.map(
    (e) => `Row ${e.row ?? "?"}: ${e.message}`
  );

  const col = (row: Record<string, string>, ...names: string[]) => {
    for (const n of names) {
      if (row[n] !== undefined) return row[n];
    }
    const key = Object.keys(row).find((k) =>
      names.some((n) => k.trim().toLowerCase().startsWith(n.toLowerCase()))
    );
    return key ? row[key] : undefined;
  };

  // Average-cost book per asset.
  const book = new Map<string, { qty: number; cost: number }>();
  const entry = (symbol: string) => {
    const existing = book.get(symbol);
    if (existing) return existing;
    const created = { qty: 0, cost: 0 };
    book.set(symbol, created);
    return created;
  };

  let currencyWarned = false;
  let rowCount = 0;

  data.forEach((row, i) => {
    const type = (col(row, "Transaction Type") ?? "").trim();
    const symbol = (col(row, "Asset") ?? "").trim().toUpperCase();
    const qty = num(col(row, "Quantity Transacted"));
    if (!type || !symbol || qty === null || qty <= 0) return;
    rowCount++;

    const currency = (
      col(row, "Spot Price Currency", "Price Currency") ?? ""
    ).trim();
    if (currency && currency !== "CAD" && !currencyWarned) {
      errors.push(
        `This export is priced in ${currency}, not CAD — costs will be in ${currency}.`
      );
      currencyWarned = true;
    }

    const spot = num(col(row, "Spot Price at Transaction", "Price at Transaction"));
    const subtotal = num(col(row, "Subtotal"));
    const costOfRow = subtotal ?? (spot !== null ? qty * spot : 0);

    if (ACQUIRE_RE.test(type)) {
      const b = entry(symbol);
      b.qty += qty;
      b.cost += costOfRow;
    } else if (DISPOSE_RE.test(type)) {
      const b = entry(symbol);
      const avg = b.qty > 0 ? b.cost / b.qty : 0;
      b.cost = Math.max(0, b.cost - avg * qty);
      b.qty -= qty;
    } else if (CONVERT_RE.test(type)) {
      // Source asset leaves the book like a sell…
      const b = entry(symbol);
      const avg = b.qty > 0 ? b.cost / b.qty : 0;
      b.cost = Math.max(0, b.cost - avg * qty);
      b.qty -= qty;
      // …and the target asset (from the notes) enters at the subtotal.
      const notes = col(row, "Notes") ?? "";
      const match = notes.match(CONVERT_NOTES_RE);
      if (match) {
        const targetQty = Number.parseFloat(match[1].replace(/,/g, ""));
        const targetSymbol = match[2].toUpperCase();
        if (!Number.isNaN(targetQty) && targetQty > 0) {
          const target = entry(targetSymbol);
          target.qty += targetQty;
          target.cost += costOfRow;
        }
      } else {
        errors.push(
          `Row ${i + 2}: couldn't read the convert target from the notes.`
        );
      }
    }
    // Unknown types (e.g. "Exchange Deposit") are ignored on purpose.
  });

  const holdings: ParsedCryptoHolding[] = [...book.entries()]
    .filter(([, b]) => b.qty > 1e-8)
    .map(([symbol, b]) => ({
      symbol,
      name: symbol,
      quantity: Math.round(b.qty * 1e8) / 1e8,
      average_cost_cad:
        b.qty > 0 ? Math.round((b.cost / b.qty) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { holdings, errors, rowCount };
}
