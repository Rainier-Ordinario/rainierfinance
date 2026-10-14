import { describe, expect, it } from "vitest";
import {
  looksLikeWealthsimpleCsv,
  parseWealthsimpleCsv,
} from "@/lib/parsers/wealthsimple-csv";

const LEGACY = [
  "Symbol,Security Name,Quantity,Book Value,Market Price,Market Value,Unrealized Gain/Loss",
  "VFV,Vanguard S&P 500 Index ETF,10,1000,120,1200,200",
  "AMD,Advanced Micro Devices,5,500,150,750,250",
].join("\n");

const REPORT = [
  "Account Name,Account Type,Account Classification,Account Number,Symbol,Exchange,MIC,Name,Security Type,Quantity,Position Direction,Market Price,Market Price Currency,Book Value (CAD),Market Value,Market Unrealized Returns",
  "My TFSA,TFSA,Registered,ABC123,XEQT,TSX,XTSE,iShares All-Equity ETF,EXCHANGE_TRADED_FUND,20,Long,30,CAD,500,600,100",
  "My TFSA,TFSA,Registered,ABC123,NVDA,NASDAQ,XNAS,NVIDIA Corp,EQUITY,2,Long,180,USD,300,360,60",
].join("\n");

describe("looksLikeWealthsimpleCsv", () => {
  it("recognizes both formats", () => {
    expect(looksLikeWealthsimpleCsv(LEGACY.split("\n")[0].split(","))).toBe(
      true
    );
    expect(looksLikeWealthsimpleCsv(REPORT.split("\n")[0].split(","))).toBe(
      true
    );
    expect(looksLikeWealthsimpleCsv(["Date", "Amount"])).toBe(false);
  });
});

describe("parseWealthsimpleCsv (legacy)", () => {
  const { holdings, errors } = parseWealthsimpleCsv(LEGACY);

  it("parses holdings with derived average cost", () => {
    expect(errors).toHaveLength(0);
    expect(holdings[0]).toMatchObject({
      symbol: "VFV",
      quantity: 10,
      average_cost: 100,
      market_value: 1200,
      unrealized_gain: 200,
      unrealized_gain_pct: 20,
    });
  });

  it("classifies known ETFs vs equities", () => {
    expect(holdings[0].asset_type).toBe("ETF");
    expect(holdings[1].asset_type).toBe("EQUITY");
  });
});

describe("parseWealthsimpleCsv (holdings report)", () => {
  const { holdings, errors } = parseWealthsimpleCsv(REPORT);

  it("parses the report format with account types", () => {
    expect(errors).toHaveLength(0);
    expect(holdings[0]).toMatchObject({
      symbol: "XEQT",
      quantity: 20,
      average_cost: 25,
      asset_type: "ETF",
      account_type: "TFSA",
    });
    expect(holdings[1]).toMatchObject({
      symbol: "NVDA",
      asset_type: "EQUITY",
      account_type: "TFSA",
    });
  });
});
