import { describe, expect, it } from "vitest";
import {
  detectRecurringCharges,
  monthlyAmount,
  rolledBillingDate,
} from "@/lib/utils/subscriptions";
import type { Subscription, Transaction } from "@/types";

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: "s1",
    user_id: "u1",
    account_id: null,
    name: "Netflix",
    amount: 15.49,
    currency: "CAD",
    billing_cycle: "monthly",
    next_billing_date: "2026-08-01",
    category: null,
    status: "active",
    logo_url: null,
    created_at: "",
    ...partial,
  };
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    account_id: "a1",
    amount: -15.49,
    description: "NETFLIX.COM 123",
    category: "Streaming",
    subcategory: null,
    date: "2026-07-05",
    type: "expense",
    is_recurring: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("monthlyAmount", () => {
  it("normalizes billing cycles to a monthly cost", () => {
    expect(monthlyAmount(sub({ amount: 10, billing_cycle: "monthly" }))).toBe(10);
    expect(monthlyAmount(sub({ amount: 120, billing_cycle: "yearly" }))).toBe(10);
    expect(monthlyAmount(sub({ amount: 12, billing_cycle: "weekly" }))).toBe(52);
  });
});

describe("detectRecurringCharges", () => {
  const netflix3Months = [
    tx({ date: "2026-04-05" }),
    tx({ date: "2026-05-05" }),
    tx({ date: "2026-06-05" }),
  ];

  it("detects a charge recurring in 3 distinct months", () => {
    const [found] = detectRecurringCharges(netflix3Months, []);
    expect(found).toMatchObject({
      key: "netflix com",
      name: "Netflix Com",
      amount: 15.49,
      occurrences: 3,
      next_billing_date: "2026-07-05",
    });
  });

  it("handles mixed stored signs", () => {
    const mixed = [
      tx({ date: "2026-04-05", amount: -15.49 }),
      tx({ date: "2026-05-05", amount: 15.49 }),
      tx({ date: "2026-06-05", amount: -15.49 }),
    ];
    expect(detectRecurringCharges(mixed, [])).toHaveLength(1);
  });

  it("skips merchants already tracked as subscriptions", () => {
    expect(detectRecurringCharges(netflix3Months, [sub({})])).toHaveLength(0);
  });

  it("requires 3 distinct months", () => {
    expect(
      detectRecurringCharges(netflix3Months.slice(0, 2), [])
    ).toHaveLength(0);
  });

  it("rejects amounts varying more than ±15%", () => {
    const varying = [
      tx({ date: "2026-04-05", amount: -15.49 }),
      tx({ date: "2026-05-05", amount: -15.49 }),
      tx({ date: "2026-06-05", amount: -20 }),
    ];
    expect(detectRecurringCharges(varying, [])).toHaveLength(0);
  });

  it("ignores everyday-errand categories", () => {
    const groceries = netflix3Months.map((t) => ({
      ...t,
      description: "WHOLEFDS 123",
      category: "Groceries",
    }));
    expect(detectRecurringCharges(groceries, [])).toHaveLength(0);
  });

  it("rejects sparse charges that aren't roughly monthly", () => {
    const sparse = [
      tx({ date: "2026-01-05" }),
      tx({ date: "2026-06-05" }),
      tx({ date: "2026-07-05" }),
    ];
    expect(detectRecurringCharges(sparse, [])).toHaveLength(0);
  });
});

describe("rolledBillingDate", () => {
  const now = new Date(2026, 8, 27); // Sep 27, 2026

  it("leaves upcoming and same-day dates alone", () => {
    expect(rolledBillingDate(sub({ next_billing_date: "2026-10-05" }), now)).toBe("2026-10-05");
    expect(rolledBillingDate(sub({ next_billing_date: "2026-09-27" }), now)).toBe("2026-09-27");
  });

  it("rolls a passed monthly date to the next charge", () => {
    expect(rolledBillingDate(sub({ next_billing_date: "2026-09-10" }), now)).toBe("2026-10-10");
    expect(rolledBillingDate(sub({ next_billing_date: "2026-05-30" }), now)).toBe("2026-09-30");
  });

  it("treats a missing cycle as monthly", () => {
    expect(
      rolledBillingDate(sub({ billing_cycle: null, next_billing_date: "2026-09-01" }), now)
    ).toBe("2026-10-01");
  });

  it("keeps month-end anchors from drifting", () => {
    expect(
      rolledBillingDate(sub({ next_billing_date: "2026-01-31" }), new Date(2026, 2, 5))
    ).toBe("2026-03-31");
  });

  it("steps weekly and yearly cycles", () => {
    expect(
      rolledBillingDate(sub({ billing_cycle: "weekly", next_billing_date: "2026-09-20" }), now)
    ).toBe("2026-09-27");
    expect(
      rolledBillingDate(sub({ billing_cycle: "yearly", next_billing_date: "2026-03-15" }), now)
    ).toBe("2027-03-15");
  });

  it("doesn't renew paused or cancelled subscriptions", () => {
    expect(
      rolledBillingDate(sub({ status: "paused", next_billing_date: "2026-09-01" }), now)
    ).toBe("2026-09-01");
  });
});
