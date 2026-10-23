import { describe, expect, it } from "vitest";
import {
  applyMerchantRules,
  categorizeMerchant,
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
