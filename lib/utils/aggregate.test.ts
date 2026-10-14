import { describe, expect, it } from "vitest";
import {
  cashFlowByMonth,
  categoryTotalsInRange,
  monthlyExpenses,
  monthlyIncome,
  netWorth,
  savingsRate,
  topCategories,
  totalAssets,
  totalLiabilities,
} from "@/lib/utils/aggregate";
import type { Account, Transaction } from "@/types";

function acct(partial: Partial<Account>): Account {
  return {
    id: "a1",
    user_id: "u1",
    name: "Test",
    type: "chequing",
    institution: "RBC",
    balance: 0,
    credit_limit: null,
    currency: "CAD",
    color: "#000",
    account_number_last4: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    user_id: "u1",
    account_id: "a1",
    amount: 0,
    description: "test",
    category: "Other",
    subcategory: null,
    date: "2026-07-01",
    type: "expense",
    is_recurring: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("net worth", () => {
  const accounts = [
    acct({ id: "chequing", type: "chequing", balance: 5000 }),
    acct({ id: "card", type: "credit_card", balance: 800 }),
    acct({ id: "closed", type: "savings", balance: 999, is_active: false }),
  ];

  it("treats credit cards as liabilities and ignores inactive accounts", () => {
    expect(totalAssets(accounts)).toBe(5000);
    expect(totalLiabilities(accounts)).toBe(800);
    expect(netWorth(accounts)).toBe(4200);
  });
});

describe("monthly income/expenses", () => {
  const txs = [
    tx({ type: "expense", amount: -82.43, date: "2026-07-02" }), // import-style
    tx({ type: "expense", amount: 20, date: "2026-07-05" }), // seed-style
    tx({ type: "income", amount: 2000, date: "2026-07-03" }),
    tx({ type: "transfer", amount: -500, date: "2026-07-04" }),
    tx({ type: "expense", amount: -50, date: "2026-06-28" }), // out of range
  ];

  it("sums expense magnitudes regardless of stored sign", () => {
    expect(monthlyExpenses(txs, "2026-07-01", "2026-07-31")).toBeCloseTo(
      102.43
    );
  });

  it("counts only income rows, excluding transfers", () => {
    expect(monthlyIncome(txs, "2026-07-01", "2026-07-31")).toBe(2000);
  });
});

describe("savingsRate", () => {
  it("computes (income - expenses) / income", () => {
    expect(savingsRate(4000, 3000)).toBe(25);
  });
  it("is 0 with no income", () => {
    expect(savingsRate(0, 500)).toBe(0);
  });
});

describe("cashFlowByMonth", () => {
  it("returns oldest-first labelled months", () => {
    const txs = [
      tx({ type: "income", amount: 1000, date: "2026-07-02" }),
      tx({ type: "expense", amount: -100, date: "2026-06-15" }),
    ];
    const flow = cashFlowByMonth(txs, 3, new Date(2026, 6, 15));
    expect(flow.map((m) => m.label)).toEqual(["May", "Jun", "Jul"]);
    expect(flow[1].expenses).toBe(100);
    expect(flow[2].income).toBe(1000);
  });
});

describe("category totals", () => {
  it("groups expenses by category, biggest first", () => {
    const txs = [
      tx({ category: "Dining", amount: -30 }),
      tx({ category: "Dining", amount: -20 }),
      tx({ category: "Gas", amount: -60 }),
      tx({ category: "Income", amount: 900, type: "income" }),
    ];
    expect(categoryTotalsInRange(txs, "2026-07-01", "2026-07-31")).toEqual([
      { category: "Gas", amount: 60 },
      { category: "Dining", amount: 50 },
    ]);
  });

  it("topCategories folds the tail into Other", () => {
    const totals = Array.from({ length: 8 }, (_, i) => ({
      category: `C${i}`,
      amount: 100 - i,
    }));
    const top = topCategories(totals, 6);
    expect(top).toHaveLength(7);
    expect(top[6]).toEqual({ category: "Other", amount: 94 + 93 });
  });
});
