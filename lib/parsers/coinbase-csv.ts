import Papa from "papaparse";

/**
 * Coinbase transaction-history export (coinbase.com → Statements →
 * Transactions, date range "All time"). The file starts with a few preamble
 * lines, then:
 *
 *   ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,
 *   Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),
 *   Fees and/or Spread,Notes,Sender Address,Recipient Address
 *
 * Notes on the real-world format:
 * - Quantities are SIGNED: sells/sends/withdrawals/convert-out are negative.
 *   Direction is taken from the sign, so every type (Buy, Sell, Send,
 *   Receive, Convert's two rows, Reward Income, Subscription Rebates,
 *   Incentives Rewards Payout, …) is handled uniformly.
 * - Amounts are dollar-prefixed and comma-grouped ("$2,058.33").
 * - Fiat rows (Deposit/Withdrawal/Subscription with Asset CAD or USD) are
 *   not crypto holdings and are excluded.
 * - Advanced trades settle in USDC without a matching USDC row, so the
 *   quote leg is reconstructed from the Notes.
 *
 * The full history is aggregated into current holdings using average-cost
 * accounting, matching the crypto_holdings model (quantity + avg cost).
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
  /** Currency the file's costs are denominated in (usually "USD"). */
  currency: string;
}

const FIAT = new Set(["CAD", "USD"]);

/** "Bought 5000 PNG for 111.28815 USDC on PNG-USDC …" → amount + quote. */
const TRADE_QUOTE_RE =
  /\bfor\s+([\d,.]+)\s+([A-Z0-9]{2,10})\s+on\s+\S+/i;

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
      currency: "",
    };
  }

  const { data, errors: papaErrors } = Papa.parse<Record<string, string>>(
    lines.slice(headerIndex).join("\n"),
    { header: true, skipEmptyLines: true }
  );

  const errors: string[] = papaErrors
    .filter((e) => !/parsed 1$/.test(e.message))
    .map((e) => `Row ${e.row ?? "?"}: ${e.message}`);

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
  const acquire = (symbol: string, qty: number, cost: number) => {
    const b = entry(symbol);
    b.qty += qty;
    b.cost += cost;
  };
  const dispose = (symbol: string, qty: number) => {
    const b = entry(symbol);
    const avg = b.qty > 0 ? b.cost / b.qty : 0;
    b.cost = Math.max(0, b.cost - avg * qty);
    b.qty -= qty;
  };

  let currency = "";
  let rowCount = 0;

  // Older exports use unsigned quantities; fall back to type-based
  // direction when the file never uses negatives.
  const signed = data.some(
    (row) => (num(col(row, "Quantity Transacted")) ?? 0) < 0
  );
  const DISPOSE_TYPE_RE = /^(sell|advanced? trade sell|send|withdrawal)$/i;

  // Exports are newest-first; average-cost accounting must run in
  // chronological order or disposals precede the buys that funded them.
  const ordered = [...data].sort((a, b) =>
    (col(a, "Timestamp") ?? "").localeCompare(col(b, "Timestamp") ?? "")
  );

  ordered.forEach((row) => {
    const type = (col(row, "Transaction Type") ?? "").trim();
    const symbol = (col(row, "Asset") ?? "").trim().toUpperCase();
    const rawQty = num(col(row, "Quantity Transacted"));
    if (!type || !symbol || rawQty === null || rawQty === 0) return;
    rowCount++;

    if (!currency) {
      currency = (
        col(row, "Spot Price Currency", "Price Currency") ?? ""
      ).trim();
    }

    const spot = num(
      col(row, "Spot Price at Transaction", "Price at Transaction")
    );
    const subtotal = num(col(row, "Subtotal"));
    const qty = Math.abs(rawQty);
    const rowValue = Math.abs(
      subtotal ?? (spot !== null ? qty * spot : 0)
    );

    const isDisposal = signed ? rawQty < 0 : DISPOSE_TYPE_RE.test(type);

    if (!FIAT.has(symbol)) {
      if (isDisposal) dispose(symbol, qty);
      else acquire(symbol, qty, rowValue);
    }

    // Advanced trades settle in a crypto quote currency (usually USDC)
    // without emitting a row for it — reconstruct that leg from the notes.
    if (/^advanced? trade (buy|sell)$/i.test(type)) {
      const match = (col(row, "Notes") ?? "").match(TRADE_QUOTE_RE);
      if (match) {
        const quoteAmount = Number.parseFloat(match[1].replace(/,/g, ""));
        const quoteSymbol = match[2].toUpperCase();
        if (
          !Number.isNaN(quoteAmount) &&
          quoteAmount > 0 &&
          !FIAT.has(quoteSymbol)
        ) {
          if (isDisposal) acquire(quoteSymbol, quoteAmount, rowValue);
          else dispose(quoteSymbol, quoteAmount);
        }
      }
    }
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

  return { holdings, errors, rowCount, currency };
}
