import { describe, expect, it } from "vitest";
import {
  categoryBreakdown,
  categoryKind,
  categoryTrends,
  safeToSpend,
  spendingMix,
  topMerchants,
  uncategorizedSummary,
  whatChanged,
} from "@/lib/utils/spending";
import type { Category, Transaction } from "@/types";

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

function cat(name: string, kind: Category["kind"] = null): Category {
  return {
    id: name,
    user_id: "u1",
    name,
    icon: "circle",
    color: "#000",
    type: "expense",
    kind,
    is_default: true,
    created_at: "",
  };
}

const now = new Date(2026, 9, 22); // Oct 22, 2026

describe("categoryKind", () => {
  it("uses the user's choice, then a default by name", () => {
    expect(categoryKind("Bills", [])).toBe("fixed");
    expect(categoryKind("Groceries", [])).toBe("essential");
    expect(categoryKind("Dining", [])).toBe("discretionary");
    expect(categoryKind("Dining", [cat("Dining", "essential")])).toBe("essential");
  });
});

describe("uncategorizedSummary", () => {
  it("measures Other spending in the window", () => {
    const s = uncategorizedSummary(
      [
        tx({ category: "Other", amount: -25 }),
        tx({ category: "Dining", amount: 75 }),
        tx({ category: "Other", amount: -500, date: "2026-01-01" }),
        tx({ category: "Other", amount: 900, type: "income" }),
      ],
      90,
      now
    );
    expect(s).toMatchObject({ amount: 25, count: 1, share: 25 });
  });
});

describe("spendingMix", () => {
  it("paces month to date against the same point last month", () => {
    const mix = spendingMix(
      [
        tx({ date: "2026-10-03", amount: -100 }),
        tx({ date: "2026-10-01", category: "Bills", amount: -80 }),
        tx({ date: "2026-09-10", amount: -60 }),
        tx({ date: "2026-09-28", amount: -500 }), // after Sep 22: excluded
        tx({ date: "2026-07-15", category: "Groceries", amount: -300 }),
      ],
      [],
      now
    );
    expect(mix.current).toEqual({ fixed: 80, essential: 0, discretionary: 100 });
    expect(mix.lastMonthSamePoint.discretionary).toBe(60);
    expect(mix.monthlyAverage.discretionary).toBeCloseTo(560 / 3);
    expect(mix.monthlyAverage.essential).toBe(100);
  });

  it("clamps the comparison day to the end of a short month", () => {
    const mix = spendingMix(
      [tx({ date: "2026-02-28", amount: -40 })],
      [],
      new Date(2026, 2, 31)
    );
    expect(mix.lastMonthSamePoint.discretionary).toBe(40);
  });
});

describe("categoryBreakdown", () => {
  const txs = [
    tx({ date: "2026-09-10", amount: -150 }),
    tx({ date: "2026-08-10", amount: -100 }),
    tx({ date: "2026-07-10", amount: -100 }),
    tx({ date: "2026-06-10", amount: -100 }),
    tx({ date: "2026-10-02", amount: -20 }),
  ];

  it("compares last month with the three months before it", () => {
    const b = categoryBreakdown(txs, "last_month", now);
    expect(b).toMatchObject({ start: "2026-09-01", end: "2026-09-30", months: 1 });
    expect(b.rows[0]).toMatchObject({ category: "Dining", amount: 150, baseline: 100 });
  });

  it("uses whole completed months for multi-month periods", () => {
    const b = categoryBreakdown(txs, "3_months", now);
    expect(b).toMatchObject({ start: "2026-07-01", end: "2026-09-30" });
    expect(b.rows[0]).toMatchObject({ amount: 350, perMonth: 350 / 3 });
  });

  it("covers this month to date", () => {
    const b = categoryBreakdown(txs, "this_month", now);
    expect(b).toMatchObject({ start: "2026-10-01", end: "2026-10-22" });
    expect(b.rows[0]).toMatchObject({ amount: 20, baseline: 350 / 3 });
  });
});

describe("categoryTrends", () => {
  it("buckets by month and compares the last 3 complete months to the 3 before", () => {
    const txs = [
      ...["04", "05", "06"].map((m) => tx({ date: `2026-${m}-10`, amount: -100 })),
      ...["07", "08", "09"].map((m) => tx({ date: `2026-${m}-10`, amount: -150 })),
      tx({ date: "2026-10-02", amount: -999 }), // current month: not in averages
      tx({ date: "2026-10-02", category: "Income", type: "income", amount: 5000 }),
    ];
    const [dining] = categoryTrends(txs, 12, now);
    expect(dining.category).toBe("Dining");
    expect(dining.months).toHaveLength(12);
    expect(dining.months.at(-1)).toMatchObject({ label: "Oct", amount: 999, partial: true });
    expect(dining.total).toBe(750);
    expect(dining.recentAvg).toBe(150);
    expect(dining.priorAvg).toBe(100);
    expect(dining.change).toBeCloseTo(0.5);
  });

  it("has no change without prior spend", () => {
    const [t] = categoryTrends([tx({ date: "2026-09-10" })], 12, now);
    expect(t.change).toBeNull();
  });
});

describe("topMerchants", () => {
  it("groups store numbers under one merchant", () => {
    const merchants = topMerchants(
      [
        tx({ description: "STARBUCKS #1018", amount: -6 }),
        tx({ description: "Starbucks 2201", amount: -8, date: "2026-10-09" }),
        tx({ description: "SAVE-ON-FOODS #902", category: "Groceries", amount: -120 }),
      ],
      "2026-10-01",
      "2026-10-31"
    );
    expect(merchants.map((m) => m.name)).toEqual(["Save On Foods", "Starbucks"]);
    expect(merchants[1]).toMatchObject({
      visits: 2,
      total: 14,
      average: 7,
      lastDate: "2026-10-09",
      category: "Dining",
      searchTerm: "starbucks",
    });
  });
});

describe("safeToSpend", () => {
  const income = (date: string, amount: number) =>
    tx({ date, amount, type: "income", category: "Income" });
  const history = [
    ...["07", "08", "09"].flatMap((m) => [
      income(`2026-${m}-15`, 4000),
      tx({ date: `2026-${m}-01`, category: "Bills", amount: -1500 }),
      tx({ date: `2026-${m}-05`, category: "Groceries", amount: -500 }),
    ]),
  ];

  it("reserves usual bills not yet charged and spreads the rest over the month", () => {
    const s = safeToSpend(
      [
        ...history,
        tx({ date: "2026-10-10", amount: -200 }), // dining before today
        tx({ date: "2026-10-22", amount: -30 }), // dining today
      ],
      [],
      20,
      now
    )!;
    expect(s.expectedIncome).toBe(4000);
    expect(s.expectedFixed).toBe(1500);
    expect(s.expectedEssential).toBe(500);
    expect(s.savingsTarget).toBe(800);
    expect(s.wantsBudget).toBe(1200);
    expect(s.spentBeforeToday).toBe(200);
    expect(s.spentToday).toBe(30);
    expect(s.daysLeft).toBe(10); // Oct 22–31
    expect(s.dailyAllowance).toBe(100);
    expect(s.remaining).toBe(970);
  });

  it("uses actual income and costs when they beat the usual", () => {
    const s = safeToSpend(
      [...history, income("2026-10-15", 6000), tx({ date: "2026-10-01", category: "Bills", amount: -1800 })],
      [],
      0,
      now
    )!;
    expect(s.expectedIncome).toBe(6000);
    expect(s.expectedFixed).toBe(1800);
  });

  it("never goes below zero per day, and needs income to say anything", () => {
    const s = safeToSpend([...history, tx({ date: "2026-10-03", amount: -5000 })], [], 20, now)!;
    expect(s.dailyAllowance).toBe(0);
    expect(s.remaining).toBeLessThan(0);
    expect(safeToSpend([tx({})], [], 20, now)).toBeNull();
  });
});

describe("whatChanged", () => {
  const sep = { start: "2026-09-01", end: "2026-09-30" };
  const baselines = [
    { start: "2026-06-01", end: "2026-06-30" },
    { start: "2026-07-01", end: "2026-07-31" },
    { start: "2026-08-01", end: "2026-08-31" },
  ];
  const usualMonths = ["06", "07", "08"].flatMap((m) => [
    tx({ date: `2026-${m}-05`, category: "Food Delivery", description: "DOORDASH", amount: -100 }),
    tx({ date: `2026-${m}-06`, category: "Shopping", description: "AMAZON.CA", amount: -200 }),
    tx({ date: `2026-${m}-07`, category: "Groceries", description: "SAVE-ON-FOODS", amount: -400 }),
  ]);

  it("finds the biggest movers and the merchants behind them", () => {
    const result = whatChanged(
      [
        ...usualMonths,
        tx({ date: "2026-09-05", category: "Food Delivery", description: "DOORDASH", amount: -150 }),
        tx({ date: "2026-09-12", category: "Food Delivery", description: "UBER EATS 22", amount: -60 }),
        tx({ date: "2026-09-06", category: "Shopping", description: "AMAZON.CA", amount: -50 }),
        tx({ date: "2026-09-07", category: "Groceries", description: "SAVE-ON-FOODS", amount: -410 }),
      ],
      sep,
      baselines
    );
    expect(result.up).toHaveLength(1);
    expect(result.up[0]).toMatchObject({ category: "Food Delivery", amount: 210, usual: 100, diff: 110 });
    expect(result.up[0].merchants.map((m) => m.name)).toEqual(["Uber Eats", "Doordash"]);
    expect(result.down[0]).toMatchObject({ category: "Shopping", diff: -150, pct: -0.75 });
    // Groceries +$10 is noise, not a change.
    expect([...result.up, ...result.down].map((c) => c.category)).not.toContain("Groceries");
    expect(result.usualTotal).toBe(700);
    expect(result.totalDiff).toBe(670 - 700);
  });

  it("only reports increases for a period still in progress", () => {
    const result = whatChanged(
      [...usualMonths, tx({ date: "2026-09-05", category: "Food Delivery", description: "DOORDASH", amount: -150 })],
      sep,
      baselines,
      { partial: true }
    );
    expect(result.down).toEqual([]);
    expect(result.up.map((c) => c.category)).toEqual(["Food Delivery"]);
  });
});
