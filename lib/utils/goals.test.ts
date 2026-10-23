import { describe, expect, it } from "vitest";
import {
  emergencyRunway,
  goalProgress,
  recentMonthlySaving,
} from "@/lib/utils/goals";
import type { Account, Goal, Transaction } from "@/types";

const now = new Date(2026, 9, 22); // Oct 22, 2026

function goal(partial: Partial<Goal>): Goal {
  return {
    id: "g1",
    user_id: "u1",
    name: "Trip",
    emoji: "✈️",
    target_amount: 3000,
    target_date: "2027-04-01",
    saved_amount: 600,
    account_id: null,
    created_at: "",
    ...partial,
  };
}

function account(partial: Partial<Account>): Account {
  return {
    id: "a1",
    user_id: "u1",
    name: "Savings",
    type: "savings",
    institution: "RBC",
    balance: 1500,
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
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    account_id: "a1",
    amount: -10,
    description: "X",
    category: "Dining",
    subcategory: null,
    date: "2026-09-05",
    type: "expense",
    is_recurring: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("goalProgress", () => {
  it("spreads what's left over the months to the deadline", () => {
    const p = goalProgress(goal({}), [], 500, now);
    // 2400 left over 6 months (Oct → Apr) = 400/mo; saving 500/mo → on track
    expect(p).toMatchObject({ current: 600, remaining: 2400, pct: 20, monthsLeft: 6, neededPerMonth: 400, etaMonths: 5, status: "on_track" });
    expect(goalProgress(goal({}), [], 300, now).status).toBe("behind");
  });

  it("uses a linked account's balance", () => {
    const p = goalProgress(goal({ account_id: "a1" }), [account({})], 0, now);
    expect(p.current).toBe(1500);
    expect(p.etaMonths).toBeNull();
  });

  it("handles finished and undated goals", () => {
    expect(goalProgress(goal({ saved_amount: 3200 }), [], 0, now).status).toBe("done");
    expect(goalProgress(goal({ target_date: null }), [], 600, now)).toMatchObject({ status: "no_date", etaMonths: 4 });
  });
});

describe("savings pace and runway", () => {
  const history = ["07", "08", "09"].flatMap((m) => [
    tx({ date: `2026-${m}-01`, type: "income", category: "Income", amount: 4000 }),
    tx({ date: `2026-${m}-02`, category: "Bills", amount: -1500 }),
    tx({ date: `2026-${m}-03`, category: "Groceries", amount: -500 }),
    tx({ date: `2026-${m}-04`, category: "Dining", amount: -400 }),
  ]);

  it("averages what was actually saved over the last 3 complete months", () => {
    expect(recentMonthlySaving(history, now)).toBe(1600);
  });

  it("measures how many months of needs cash covers", () => {
    const r = emergencyRunway(history, [], [account({ balance: 5000 }), account({ id: "c", type: "credit_card", balance: 900 })], now);
    expect(r).toMatchObject({ monthlyNeeds: 2000, cash: 5000, months: 2.5, suggestedTarget: 6000 });
  });
});
