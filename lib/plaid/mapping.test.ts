import { describe, expect, it } from "vitest";
import type { Transaction as PlaidTransaction } from "plaid";
import {
  appAccountType,
  dropCsvOverlap,
  mapPlaidTransaction,
  mapPlaidTransactions,
} from "@/lib/plaid/mapping";

const tx = (overrides: Partial<PlaidTransaction> = {}) =>
  ({
    transaction_id: "t1",
    account_id: "a1",
    amount: 12.5,
    name: "STARBUCKS #1234",
    merchant_name: "Starbucks",
    date: "2026-10-06",
    authorized_date: "2026-10-05",
    pending: false,
    pending_transaction_id: null,
    personal_finance_category: null,
    ...overrides,
  }) as PlaidTransaction;

describe("appAccountType", () => {
  it("maps Plaid types and subtypes to app account types", () => {
    expect(appAccountType({ type: "depository" as never, subtype: "checking" as never })).toBe("chequing");
    expect(appAccountType({ type: "depository" as never, subtype: "savings" as never })).toBe("savings");
    expect(appAccountType({ type: "credit" as never, subtype: "credit card" as never })).toBe("credit_card");
    expect(appAccountType({ type: "investment" as never, subtype: "tfsa" as never })).toBe("tfsa");
    expect(appAccountType({ type: "investment" as never, subtype: "rrsp" as never })).toBe("investment");
  });

  it("skips loans", () => {
    expect(appAccountType({ type: "loan" as never, subtype: "mortgage" as never })).toBeNull();
  });
});

describe("mapPlaidTransaction", () => {
  it("flips Plaid's sign and uses the purchase date", () => {
    const t = mapPlaidTransaction(tx(), {});
    expect(t.amount).toBe(-12.5);
    expect(t.date).toBe("2026-10-05");
    expect(t).toMatchObject({ category: "Dining", type: "expense" });
  });

  it("falls back to the posted date", () => {
    expect(mapPlaidTransaction(tx({ authorized_date: null }), {}).date).toBe("2026-10-06");
  });

  it("prefers a learned merchant rule", () => {
    const t = mapPlaidTransaction(tx(), { starbucks: "Entertainment" });
    expect(t.category).toBe("Entertainment");
  });

  it("uses Plaid's category when the keywords don't know the merchant", () => {
    const t = mapPlaidTransaction(
      tx({
        name: "KINTON 0042",
        merchant_name: null,
        personal_finance_category: {
          primary: "FOOD_AND_DRINK",
          detailed: "FOOD_AND_DRINK_RESTAURANT",
        },
      }),
      {}
    );
    expect(t.category).toBe("Dining");
  });

  it("treats card payments and own-account moves as transfers", () => {
    const payment = mapPlaidTransaction(
      tx({
        amount: -500,
        name: "PAYMENT - THANK YOU",
        merchant_name: null,
      }),
      {}
    );
    expect(payment).toMatchObject({ type: "transfer", category: "Transfer" });

    const viaCategory = mapPlaidTransaction(
      tx({
        name: "Funds moved",
        merchant_name: null,
        personal_finance_category: {
          primary: "TRANSFER_OUT",
          detailed: "TRANSFER_OUT_SAVINGS",
        },
      }),
      {}
    );
    expect(viaCategory.type).toBe("transfer");

    const investing = mapPlaidTransaction(
      tx({
        name: "Contribution",
        merchant_name: null,
        personal_finance_category: {
          primary: "TRANSFER_OUT",
          detailed: "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
        },
      }),
      {}
    );
    expect(investing).toMatchObject({ type: "transfer", category: "Investments" });
  });

  it("records credits as income", () => {
    const t = mapPlaidTransaction(
      tx({ amount: -2400, name: "PAYROLL DEPOSIT ACME", merchant_name: null }),
      {}
    );
    expect(t).toMatchObject({ amount: 2400, type: "income", category: "Income" });
  });
});

describe("mapPlaidTransactions", () => {
  it("turns a credit from a merchant the user pays into a refund", () => {
    const rows = mapPlaidTransactions(
      [tx({ transaction_id: "r1", amount: -30, name: "AMAZON.CA REFUND", merchant_name: null })],
      {},
      new Map()
    );
    expect(rows[0]).toMatchObject({ type: "expense", amount: 30, category: "Shopping" });
  });
});

describe("dropCsvOverlap", () => {
  const row = (date: string, amount: number) => ({ date, amount });

  it("keeps everything when the account had no CSV history", () => {
    expect(dropCsvOverlap([row("2026-01-01", -5)], null, [])).toHaveLength(1);
  });

  it("skips days the CSV covered and matches the last day by amount", () => {
    const kept = dropCsvOverlap(
      [
        row("2026-10-01", -10),
        row("2026-10-05", -20),
        row("2026-10-05", -20),
        row("2026-10-05", -7),
        row("2026-10-06", -3),
      ],
      "2026-10-05",
      [-20]
    );
    expect(kept).toEqual([
      row("2026-10-05", -20),
      row("2026-10-05", -7),
      row("2026-10-06", -3),
    ]);
  });
});
