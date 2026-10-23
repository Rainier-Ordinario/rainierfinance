import { describe, expect, it } from "vitest";
import {
  budgetPeriodRange,
  budgetProgress,
  budgetSuggestion,
  roundBudget,
  suggestBudgets,
} from "@/lib/utils/budgets";
import { toISODate } from "@/lib/utils/dates";
import type { Budget, Category, Transaction } from "@/types";

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

describe("budget suggestions", () => {
  const now = new Date(2026, 9, 22); // Oct 22, 2026
  const history = [
    tx({ date: "2026-07-03", amount: -280 }),
    tx({ date: "2026-08-03", amount: -310 }),
    tx({ date: "2026-09-03", amount: -340 }),
    tx({ date: "2026-10-03", amount: -999 }), // current month: ignored
    tx({ date: "2026-09-04", category: "Bills", amount: -1500 }),
    tx({ date: "2026-09-05", category: "Streaming", amount: -20 }),
    tx({ date: "2026-09-06", category: "Other", amount: -400 }),
  ];

  it("rounds to amounts people type", () => {
    expect(roundBudget(43)).toBe(45);
    expect(roundBudget(312)).toBe(310);
    expect(roundBudget(1312)).toBe(1300);
    expect(roundBudget(2)).toBe(5);
  });

  it("averages the last 3 complete months and offers a 10% trim", () => {
    expect(budgetSuggestion(history, "Dining", "monthly", now)).toEqual({
      usual: 310,
      suggested: 310,
      trimmed: 280,
      months: 3,
    });
  });

  it("converts to weekly and yearly budgets", () => {
    expect(budgetSuggestion(history, "Dining", "weekly", now)?.usual).toBeCloseTo(
      (310 * 12) / 52
    );
    // Yearly looks back 12 months but history only starts in July.
    expect(budgetSuggestion(history, "Dining", "yearly", now)).toMatchObject({
      usual: 310 * 12,
      months: 3,
    });
  });

  it("doesn't average over months before history begins", () => {
    const s = budgetSuggestion([tx({ date: "2026-09-03", amount: -200 })], "Dining", "monthly", now);
    expect(s).toMatchObject({ usual: 200, months: 1 });
    expect(budgetSuggestion([tx({ date: "2026-10-03" })], "Dining", "monthly", now)).toBeNull();
  });

  it("suggests unbudgeted everyday categories, skipping fixed bills, Other, and small ones", () => {
    const cat = (name: string): Category => ({
      id: name, user_id: "u1", name, icon: "x", color: "#000",
      type: "expense", is_default: true, created_at: "",
    });
    const categories = ["Dining", "Bills", "Streaming", "Groceries", "Other"].map(cat);
    expect(
      suggestBudgets(history, categories, [], 4, now).map((s) => s.category.name)
    ).toEqual(["Dining"]);
    expect(
      suggestBudgets(history, categories, [budget({ category: "Dining" })], 4, now)
    ).toEqual([]);
  });
});
