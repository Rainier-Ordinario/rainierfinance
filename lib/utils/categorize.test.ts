import { describe, expect, it } from "vitest";
import {
  applyMerchantRules,
  categorizeMerchant,
  classifyRefunds,
  looksLikeRefund,
  merchantKey,
} from "@/lib/utils/categorize";

describe("merchantKey", () => {
  it("ignores store numbers, punctuation and case", () => {
    expect(merchantKey("STARBUCKS #1234 VANCOUVER")).toBe("starbucks vancouver");
    expect(merchantKey("Starbucks 0567 Vancouver")).toBe("starbucks vancouver");
  });
});

describe("categorizeMerchant", () => {
  it("falls back to Other for unknown merchants", () => {
    expect(categorizeMerchant("ZZQX HOLDINGS")).toBe("Other");
  });

  it("prefers a learned rule over built-in keywords", () => {
    expect(categorizeMerchant("COSTCO WHOLESALE #55")).toBe("Shopping");
    expect(
      categorizeMerchant("COSTCO WHOLESALE #55", {
        "costco wholesale": "Groceries",
      })
    ).toBe("Groceries");
  });
});

describe("applyMerchantRules", () => {
  it("recategorizes matching expenses only", () => {
    const rows = [
      { description: "ZZQX HOLDINGS 9", category: "Other", type: "expense" },
      { description: "ZZQX HOLDINGS 9", category: "Income", type: "income" },
      { description: "UNKNOWN", category: "Other", type: "expense" },
    ];
    const out = applyMerchantRules(rows, { "zzqx holdings": "Bills" });
    expect(out.map((r) => r.category)).toEqual(["Bills", "Income", "Other"]);
  });
});

describe("refund detection", () => {
  const none = new Map<string, string>();

  it("treats explicit refunds and card offers as refunds", () => {
    expect(looksLikeRefund("PIEVAT*REFUND SAN FRAN", none)).toBe(true);
    expect(looksLikeRefund("OFFER Burger King", none)).toBe(true);
    expect(looksLikeRefund("ANNUAL FEE REBATE", none)).toBe(true);
  });

  it("treats paycheques, interest, and e-transfers as income", () => {
    expect(looksLikeRefund("PAYROLL DEPOSIT ACME", none)).toBe(false);
    expect(looksLikeRefund("DEPOSIT INTEREST", none)).toBe(false);
    expect(looksLikeRefund("E-TRANSFER RECEIVED JANE", none)).toBe(false);
    expect(looksLikeRefund("CRA TAX REFUND", none)).toBe(false);
  });

  it("treats credits from stores and known merchants as refunds", () => {
    expect(looksLikeRefund("Amazon.ca 866-216-1072", none)).toBe(true);
    expect(looksLikeRefund("MCDONALD'S #19207", none)).toBe(true);
    expect(looksLikeRefund("ZZQX CYCLE SHOP 40", none)).toBe(false);
    expect(looksLikeRefund("ZZQX CYCLE SHOP 40", new Map([["zzqx cycle shop", "Shopping"]]))).toBe(true);
  });

  it("files a refund under the merchant's usual category", () => {
    const rows = classifyRefunds(
      [
        { description: "ZZQX CYCLE SHOP 12", amount: -90, category: "Entertainment", type: "expense" },
        { description: "ZZQX CYCLE SHOP 12", amount: 90, category: "Income", type: "income" },
      ],
      none
    );
    expect(rows[1]).toMatchObject({ type: "expense", amount: 90, category: "Entertainment" });
  });

  it("converts refund credits to positive expenses in the merchant's category", () => {
    const rows = classifyRefunds(
      [
        { description: "ZZQX CYCLE SHOP 12", amount: -90, category: "Other", type: "expense" },
        { description: "ZZQX CYCLE SHOP 12", amount: 90, category: "Income", type: "income" },
        { description: "PAYROLL DEPOSIT", amount: 4200, category: "Income", type: "income" },
      ],
      none,
      { "zzqx cycle shop": "Shopping" }
    );
    expect(rows[1]).toMatchObject({ type: "expense", amount: 90, category: "Shopping" });
    expect(rows[2].type).toBe("income");
  });
});
