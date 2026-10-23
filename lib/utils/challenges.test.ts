import { describe, expect, it } from "vitest";
import {
  challengeProgress,
  suggestCapChallenges,
} from "@/lib/utils/challenges";
import type { Challenge, Transaction } from "@/types";

const now = new Date(2026, 9, 22); // Oct 22, 2026 (31-day month)

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    account_id: "a1",
    amount: -10,
    description: "X",
    category: "Food Delivery",
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

function challenge(partial: Partial<Challenge>): Challenge {
  return {
    id: "c1",
    user_id: "u1",
    kind: "category_cap",
    category: "Food Delivery",
    target: 150,
    month: "2026-10-01",
    created_at: "",
    ...partial,
  };
}

describe("category cap challenges", () => {
  it("projects spend at the current pace", () => {
    const p = challengeProgress(challenge({}), [tx({ amount: -88 })], [], now);
    // $88 over 22 days → $124 by the 31st → under the $150 cap
    expect(p).toMatchObject({ value: 88, daysLeft: 9, status: "on_track" });
    expect(p.projected).toBeCloseTo(124);
    expect(challengeProgress(challenge({}), [tx({ amount: -120 })], [], now).status).toBe("at_risk");
    expect(challengeProgress(challenge({}), [tx({ amount: -160 })], [], now).status).toBe("lost");
  });

  it("nets refunds and settles finished months", () => {
    const sep = challenge({ month: "2026-09-01" });
    const txs = [tx({ date: "2026-09-04", amount: -170 }), tx({ date: "2026-09-09", amount: 30 })];
    expect(challengeProgress(sep, txs, [], now)).toMatchObject({ value: 140, daysLeft: 0, status: "won" });
  });
});

describe("no-spend day challenges", () => {
  const days = challenge({ kind: "no_spend_days", category: null, target: 15 });

  it("counts finished days without discretionary purchases", () => {
    const txs = [
      tx({ date: "2026-10-02", category: "Dining" }),
      tx({ date: "2026-10-09", category: "Shopping" }),
      tx({ date: "2026-10-10", category: "Bills", amount: -900 }), // not discretionary
      tx({ date: "2026-10-22", category: "Dining" }), // today: not counted yet
    ];
    const p = challengeProgress(days, txs, [], now);
    // Oct 1–21 = 21 finished days, 2 with spending → 19
    expect(p).toMatchObject({ value: 19, status: "won", streak: 12 });
  });

  it("is lost once too few days remain", () => {
    const spendy = Array.from({ length: 21 }, (_, i) =>
      tx({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, category: "Dining" })
    );
    expect(challengeProgress(days, spendy, [], now).status).toBe("lost");
  });
});

describe("suggestCapChallenges", () => {
  it("proposes ~20% under the usual for big discretionary categories", () => {
    const txs = ["07", "08", "09"].flatMap((m) => [
      tx({ date: `2026-${m}-05`, amount: -225 }),
      tx({ date: `2026-${m}-06`, category: "Groceries", amount: -500 }),
      tx({ date: `2026-${m}-07`, category: "Dining", amount: -20 }),
    ]);
    expect(suggestCapChallenges(txs, [], [], 3, now)).toEqual([
      { category: "Food Delivery", usual: 225, cap: 180 },
    ]);
    expect(suggestCapChallenges(txs, [], ["Food Delivery"], 3, now)).toEqual([]);
  });
});
