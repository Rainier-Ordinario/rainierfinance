import { describe, expect, it } from "vitest";
import { dedupeImport, splitError } from "@/lib/utils/importDedup";

const row = (amount: number, extra = {}) => ({
  date: "2026-10-05",
  description: "COSTCO WHOLESALE",
  amount,
  account_id: "a1",
  ...extra,
});

describe("dedupeImport", () => {
  it("recognizes the same transaction in RBC's other download format", () => {
    const existing = [
      row(-18.89, { description: "JOES PIZZA VANCOUVER" }),
      row(3, { description: "E-TRANSFER RECEIVED JANE DOE CA1234AB" }),
      row(-4065.4, { description: "ONLINE TRANSFER TO DEPOSIT ACCOUNT-1111" }),
      row(0.48, { description: "BONUS DEPOSIT INTEREST" }),
      row(-1000, { description: "E-TRANSFER REQUEST FULFILLED EXAMPLE EXCHANGE INC." }),
    ];
    const { toInsert, skipped } = dedupeImport(
      [
        row(-18.89, { description: "JOES PIZZA VANCOUVER BC" }),
        row(3, { description: "Email Trfs E-TRANSFER RECEIVED" }),
        row(-4065.4, { description: "WWW TRF DDA - 1111" }),
        row(0.48, { description: "BONUS DEP INT" }),
        row(-1000, { description: "E-TRF REQFUL" }),
      ],
      existing
    );
    expect(skipped).toBe(5);
    expect(toInsert).toEqual([]);
  });

  it("keeps a different purchase with the same day and amount", () => {
    const { toInsert } = dedupeImport(
      [row(-5, { description: "COFFEE SHOP #12" })],
      [row(-5, { description: "STARBUCKS #1234" })]
    );
    expect(toInsert).toHaveLength(1);
  });

  it("matches each existing row only once across formats", () => {
    const { toInsert, skipped } = dedupeImport(
      [
        row(-15.25, { description: "CAMPUS GRILL BURNABY BC" }),
        row(-15.25, { description: "CAMPUS GRILL BURNABY BC" }),
      ],
      [row(-15.25, { description: "CAMPUS GRILL BURNABY" })]
    );
    expect(skipped).toBe(1);
    expect(toInsert).toHaveLength(1);
  });

  it("skips rows already imported, counting occurrences", () => {
    const { toInsert, skipped } = dedupeImport(
      [row(-50), row(-50), row(-20)],
      [row(-50)]
    );
    expect(skipped).toBe(1);
    expect(toInsert.map((r) => r.amount)).toEqual([-50, -20]);
  });

  it("recognizes a split row's original on re-import", () => {
    const existing = [
      row(-180, { split_group: "g1", split_original_amount: -240 }),
      row(-60, { split_group: "g1", split_original_amount: -240 }),
    ];
    const { toInsert, skipped } = dedupeImport([row(-240)], existing);
    expect(skipped).toBe(1);
    expect(toInsert).toEqual([]);
  });
});

describe("splitError", () => {
  it("requires parts that add up to the original", () => {
    expect(splitError(-240, [{ category: "Groceries", amount: 180 }, { category: "Shopping", amount: 60 }])).toBeNull();
    expect(splitError(-240, [{ category: "Groceries", amount: 180 }, { category: "Shopping", amount: 50 }])).toMatch(/\$10.00 left/);
    expect(splitError(-240, [{ category: "Groceries", amount: 240 }])).toMatch(/at least two/);
    expect(splitError(-0.3, [{ category: "A", amount: 0.1 }, { category: "B", amount: 0.2 }])).toBeNull();
  });
});
