import { describe, expect, it } from "vitest";
import { buildAlerts, type AlertInputs } from "@/lib/utils/alerts";
import type { Budget, Subscription, Transaction } from "@/types";

const now = new Date(2026, 9, 22);

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    account_id: "a1",
    amount: -10,
    description: "X",
    category: "Dining",
    subcategory: null,
    date: "2026-10-05",
    type: "expense",
    is_recurring: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

const base: AlertInputs = {
  transactions: [],
  categories: [],
  budgets: [],
  subscriptions: [],
  challenges: [],
  rules: {},
  savingsTargetPct: 20,
};

describe("buildAlerts", () => {
  it("flags over-budget first, then upcoming renewals and refunds", () => {
    const budget = {
      id: "b1", user_id: "u1", name: "Dining out", emoji: "🍽️", total_amount: 100,
      spent_amount: 0, period: "monthly", start_date: null, end_date: null,
      category: "Dining", color: "#000", created_at: "",
    } as Budget;
    const netflix = {
      id: "s1", user_id: "u1", account_id: null, name: "Netflix", amount: 20.99,
      currency: "CAD", billing_cycle: "monthly", next_billing_date: "2026-10-23",
      category: "Streaming", status: "active", logo_url: null, created_at: "",
    } as Subscription;
    const alerts = buildAlerts(
      {
        ...base,
        budgets: [budget],
        subscriptions: [netflix],
        transactions: [
          tx({ amount: -140 }),
          tx({ type: "income", category: "Income", description: "PAYROLL DEPOSIT", amount: 4000 }),
          tx({ type: "income", category: "Income", description: "AMAZON.CA", amount: 30 }),
        ],
      },
      now
    );
    expect(alerts.map((a) => a.title)).toEqual([
      "Dining out is $40 over budget",
      "Netflix renews tomorrow",
      "1 credit looks like refunds",
    ]);
  });

  it("is quiet when nothing needs attention", () => {
    expect(buildAlerts(base, now)).toEqual([]);
  });
});
