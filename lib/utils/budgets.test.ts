import { describe, expect, it } from "vitest";
import { budgetPeriodRange, budgetProgress } from "@/lib/utils/budgets";
import { toISODate } from "@/lib/utils/dates";
import type { Budget, Transaction } from "@/types";

function budget(partial: Partial<Budget>): Budget {
  return {
    id: "b1",
    user_id: "u1",
    name: "Dining out",
    emoji: "🍜",
    total_amount: 310,
    spent_amount: 0,
    period: "monthly",
    start_date: null,
    end_date: null,
    category: "Dining",
    color: "#000",
    created_at: "",
    ...partial,
  };
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    user_id: "u1",
    account_id: "a1",
    amount: -10,
    description: "test",
    category: "Dining",
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

// July 15, 2026 — July has 31 days.
const NOW = new Date(2026, 6, 15);

describe("budgetProgress", () => {
  const txs = [
    tx({ amount: -50, date: "2026-07-01" }), // negative-stored expense
    tx({ amount: 100, date: "2026-07-10" }), // positive-stored expense
    tx({ amount: -40, date: "2026-06-30" }), // previous month
    tx({ amount: -30, date: "2026-07-05", category: "Groceries" }), // other category
    tx({ amount: 500, date: "2026-07-08", type: "income", category: "Income" }),
  ];

  it("sums matching expense magnitudes in the current period only", () => {
    const p = budgetProgress(budget({}), txs, NOW);
    expect(p.spent).toBe(150);
    expect(p.remaining).toBe(160);
    expect(p.pctSpent).toBeCloseTo((150 / 310) * 100);
  });

  it("projects period-end spend from the current pace", () => {
    const p = budgetProgress(budget({}), txs, NOW);
    // 150 over 15 elapsed days of 31 → exactly on pace for 310
    expect(p.projected).toBeCloseTo(310);
    expect(p.status).toBe("on_track");
    expect(p.daysLeft).toBe(16);
  });

  it("flags watch when projected over, over when spent past total", () => {
    const heavy = [tx({ amount: -200, date: "2026-07-02" })];
    expect(budgetProgress(budget({}), heavy, NOW).status).toBe("watch");
    const blown = [tx({ amount: -320, date: "2026-07-02" })];
    expect(budgetProgress(budget({}), blown, NOW).status).toBe("over");
  });
});

describe("budgetPeriodRange", () => {
  it("monthly covers the calendar month", () => {
    const { start, end } = budgetPeriodRange(budget({}), NOW);
    expect(toISODate(start)).toBe("2026-07-01");
    expect(toISODate(end)).toBe("2026-07-31");
  });

  it("weekly starts Monday", () => {
    const { start, end } = budgetPeriodRange(budget({ period: "weekly" }), NOW);
    // Jul 15 2026 is a Wednesday; the week is Mon Jul 13 – Sun Jul 19
    expect(toISODate(start)).toBe("2026-07-13");
    expect(toISODate(end)).toBe("2026-07-19");
  });

  it("custom uses the stored dates", () => {
    const { start, end } = budgetPeriodRange(
      budget({ period: "custom", start_date: "2026-07-05", end_date: "2026-08-04" }),
      NOW
    );
    expect(toISODate(start)).toBe("2026-07-05");
    expect(toISODate(end)).toBe("2026-08-04");
  });
});
