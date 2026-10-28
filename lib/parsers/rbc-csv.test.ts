import { describe, expect, it } from "vitest";
import {
  groupRbcRowsByAccount,
  looksLikeRbcCsv,
  parseRbcCsv,
  rbcAccountTypeToAppType,
} from "@/lib/parsers/rbc-csv";

const HEADER =
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$";

const SAMPLE = [
  HEADER,
  'Visa,XXXX1234,7/1/2026,,WHOLEFDS #1234,,"-82.43",',
  'Visa,XXXX1234,7/2/2026,,PAYMENT - THANK YOU,,"500.00",',
  'Chequing,XXXX5678,7/3/2026,,PAYROLL DEPOSIT,ACME CORP,"2,000.00",',
  'Chequing,XXXX5678,7/4/2026,,Online Banking transfer - 1234,,"-300.00",',
  'Chequing,XXXX5678,not-a-date,,SOMETHING,,"-10.00",',
].join("\n");

describe("looksLikeRbcCsv", () => {
  it("recognizes the RBC header", () => {
    expect(looksLikeRbcCsv(HEADER.split(","))).toBe(true);
    expect(looksLikeRbcCsv(["Date", "Description", "Amount"])).toBe(false);
  });
});

describe("parseRbcCsv", () => {
  const result = parseRbcCsv(SAMPLE);

  it("parses valid rows and reports bad ones", () => {
    expect(result.transactions).toHaveLength(4);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/unrecognized date/);
  });

  it("converts M/D/YYYY dates to ISO and keeps signed amounts", () => {
    expect(result.transactions[0]).toMatchObject({
      date: "2026-07-01",
      description: "WHOLEFDS #1234",
      amount: -82.43,
      type: "expense",
      accountLast4: "1234",
    });
  });

  it("types credit-card payments as transfers, not income", () => {
    expect(result.transactions[1]).toMatchObject({
      type: "transfer",
      category: "Transfer",
    });
  });

  it("types deposits as income and joins both description columns", () => {
    expect(result.transactions[2]).toMatchObject({
      description: "PAYROLL DEPOSIT ACME CORP",
      type: "income",
      category: "Income",
      accountLast4: "5678",
    });
  });

  it("types internal transfers as transfers", () => {
    expect(result.transactions[3].type).toBe("transfer");
  });

  it("detects each account in the file once", () => {
    expect(result.detectedAccounts).toEqual([
      { last4: "1234", accountType: "Visa" },
      { last4: "5678", accountType: "Chequing" },
    ]);
  });
});

describe("rbcAccountTypeToAppType", () => {
  it("maps RBC account types", () => {
    expect(rbcAccountTypeToAppType("Visa")).toBe("credit_card");
    expect(rbcAccountTypeToAppType("MasterCard")).toBe("credit_card");
    expect(rbcAccountTypeToAppType("Savings")).toBe("savings");
    expect(rbcAccountTypeToAppType("Chequing")).toBe("chequing");
  });
});

describe("groupRbcRowsByAccount", () => {
  it("splits an all-accounts export and matches accounts by last 4 digits", () => {
    const { transactions, detectedAccounts } = parseRbcCsv(SAMPLE);
    const groups = groupRbcRowsByAccount(transactions, detectedAccounts, [
      { id: "visa-acct", account_number_last4: "1234" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ last4: "1234", accountId: "visa-acct" });
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      last4: "5678",
      accountId: null,
      newName: "RBC Chequing",
      newType: "chequing",
    });
    expect(groups[1].rows).toHaveLength(2);
  });
});
