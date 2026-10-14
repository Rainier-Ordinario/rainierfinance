import { describe, expect, it } from "vitest";
import {
  looksLikeCoinbaseCsv,
  parseCoinbaseCsv,
} from "@/lib/parsers/coinbase-csv";

const HEADER =
  "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes,Sender Address,Recipient Address";

const SAMPLE = [
  "Transactions",
  'User,abc,"2026-07-01"',
  "",
  HEADER,
  '3,2026-03-01T00:00:00Z,Sell,BTC,-0.5,USD,"$50,000.00","$25,000.00","$24,900.00",$100.00,Sold 0.5 BTC,,',
  '2,2026-02-01T00:00:00Z,Buy,BTC,0.5,USD,"$44,000.00","$22,000.00","$22,100.00",$100.00,Bought 0.5 BTC,,',
  '1,2026-01-01T00:00:00Z,Buy,BTC,0.5,USD,"$40,000.00","$20,000.00","$20,100.00",$100.00,Bought 0.5 BTC,,',
  "4,2026-04-01T00:00:00Z,Deposit,CAD,1000,CAD,$1.00,$1000.00,$1000.00,$0.00,Deposited funds,,",
  '5,2026-05-01T00:00:00Z,Advanced Trade Buy,PNG,5000,USD,$0.02,$111.29,$111.29,$0.00,Bought 5000 PNG for 111.28815 USDC on PNG-USDC at 0.02 USD,,',
].join("\n");

describe("looksLikeCoinbaseCsv", () => {
  it("recognizes the export by its header keywords", () => {
    expect(looksLikeCoinbaseCsv(SAMPLE)).toBe(true);
    expect(looksLikeCoinbaseCsv("Date,Description,Amount\n...")).toBe(false);
  });
});

describe("parseCoinbaseCsv", () => {
  const result = parseCoinbaseCsv(SAMPLE);

  it("skips the preamble and reads all rows", () => {
    expect(result.rowCount).toBe(5);
    expect(result.currency).toBe("USD");
  });

  it("average-costs signed buys/sells in chronological order", () => {
    const btc = result.holdings.find((h) => h.symbol === "BTC");
    // Bought 1.0 BTC for $42,000 (avg $42k), sold 0.5 → 0.5 left at $42k avg
    expect(btc).toMatchObject({ quantity: 0.5, average_cost_cad: 42000 });
  });

  it("excludes fiat rows from holdings", () => {
    expect(result.holdings.some((h) => h.symbol === "CAD")).toBe(false);
  });

  it("books the crypto leg of advanced trades", () => {
    const png = result.holdings.find((h) => h.symbol === "PNG");
    expect(png?.quantity).toBe(5000);
    // USDC quote leg went negative (never acquired in this file) → excluded
    expect(result.holdings.some((h) => h.symbol === "USDC")).toBe(false);
  });

  it("reports a missing header clearly", () => {
    const bad = parseCoinbaseCsv("just,some,file");
    expect(bad.holdings).toHaveLength(0);
    expect(bad.errors[0]).toMatch(/header/i);
  });
});
