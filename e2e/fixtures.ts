/**
 * Eight months of synthetic, deterministic finances relative to `now`:
 * two paycheques, rent and bills, groceries, daily coffees, rising food
 * delivery, an uncategorized merchant, two refunds still filed as income,
 * a subscription whose charges stopped, and an over-budget budget.
 */
export function syntheticData(uid: string, accountId: string, now: Date) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const transactions: Record<string, unknown>[] = [];
  for (let m = 7; m >= 0; m--) {
    const y = now.getFullYear();
    const mo = now.getMonth() - m;
    const lastDay = m === 0 ? now.getDate() : 28;
    const add = (
      day: number,
      description: string,
      amount: number,
      category: string,
      type = "expense"
    ) => {
      if (day > lastDay) return;
      transactions.push({
        user_id: uid,
        account_id: accountId,
        date: iso(new Date(y, mo, day, 12)),
        description,
        amount,
        category,
        type,
      });
    };
    add(1, "PAYROLL DEPOSIT", 4200, "Income", "income");
    add(15, "PAYROLL DEPOSIT", 4200, "Income", "income");
    add(1, "RENT PAYMENT", -1800, "Bills");
    add(3, "NETFLIX.COM", -20.99, "Streaming");
    for (const d of [2, 9, 16, 23]) add(d, `SAVE-ON-FOODS #${900 + d}`, -(110 + d), "Groceries");
    for (const d of [4, 6, 11, 13, 18, 20]) add(d, `STARBUCKS #${1000 + d}`, -(6.5 + m), "Dining");
    for (const d of [1, 7, 14, 21]) add(d, "DOORDASH*ORDER", -(35 + 8 * (7 - m)), "Food Delivery");
    add(10, "AMAZON.CA MKTP", -(60 + 30 * m), "Shopping");
    add(12, `ZZQX CYCLE SHOP ${40 + m}`, -90, "Other");
    if (m >= 3) add(18, "GOODLIFE FITNESS", -47.44, "Health");
  }
  const lastMonth = (day: number) => iso(new Date(now.getFullYear(), now.getMonth() - 1, day, 12));
  transactions.push(
    { user_id: uid, account_id: accountId, date: lastMonth(20), description: "AMAZON.CA MKTP", amount: 45, category: "Income", type: "income" },
    { user_id: uid, account_id: accountId, date: lastMonth(21), description: "OFFER Burger King", amount: 5, category: "Income", type: "income" },
    { user_id: uid, account_id: accountId, date: lastMonth(22), description: "DEPOSIT INTEREST", amount: 3.1, category: "Income", type: "income" }
  );

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  return {
    transactions,
    subscriptions: [
      { user_id: uid, name: "Netflix", amount: 18.99, billing_cycle: "monthly", next_billing_date: iso(new Date(now.getFullYear(), now.getMonth() + 1, 3, 12)), category: "Streaming", status: "active" },
      { user_id: uid, name: "GoodLife Fitness", amount: 47.44, billing_cycle: "monthly", next_billing_date: iso(tomorrow), category: "Health", status: "active" },
    ],
    budgets: [
      { user_id: uid, name: "Delivery", emoji: "🛵", total_amount: 20, spent_amount: 0, period: "monthly", category: "Food Delivery", color: "#F97316", start_date: iso(new Date(now.getFullYear(), now.getMonth(), 1, 12)) },
    ],
  };
}
