"""Unit tests for insights.py. Run from api/:  .venv/bin/python -m unittest"""

import unittest
from datetime import date

import insights

TODAY = date(2026, 10, 22)


def tx(d, amount, category="Dining", type_="expense", description="X"):
    return {"date": d, "amount": amount, "category": category, "type": type_, "description": description}


class MerchantKeyTest(unittest.TestCase):
    def test_matches_web_normalization(self):
        self.assertEqual(insights.merchant_key("STARBUCKS #1234 VANCOUVER"), "starbucks vancouver")
        self.assertEqual(insights.merchant_key("Save-On-Foods 902"), "save on foods")


class BudgetLinesTest(unittest.TestCase):
    def test_measures_spend_live_not_from_cached_column(self):
        budgets = [{"name": "Dining out", "period": "monthly", "category": "Dining",
                    "total_amount": 200, "spent_amount": 0}]
        txs = [
            tx("2026-10-05", -170),
            tx("2026-10-07", 20),  # refund
            tx("2026-09-30", -500),
            tx("2026-10-06", -40, "Groceries"),
        ]
        [line] = insights.budget_lines(budgets, txs, TODAY)
        self.assertIn("spent $150 of $200", line)
        self.assertIn("on pace to go over", line)  # $150 by day 22 → ~$211

    def test_weekly_window_starts_monday(self):
        self.assertEqual(
            insights.budget_period({"period": "weekly"}, TODAY),
            (date(2026, 10, 19), date(2026, 10, 25)),
        )


class SpendingInsightsTest(unittest.TestCase):
    def setUp(self):
        self.txs = []
        for m in ("04", "05", "06"):
            self.txs += [tx(f"2026-{m}-10", -100, "Food Delivery", description="DOORDASH")]
        for m in ("07", "08", "09"):
            self.txs += [
                tx(f"2026-{m}-01", 4000, "Income", "income"),
                tx(f"2026-{m}-02", -1500, "Bills", description="RENT"),
                tx(f"2026-{m}-10", -150, "Food Delivery", description="DOORDASH #12"),
            ]
        self.txs += [tx("2026-10-01", 4000, "Income", "income"), tx("2026-10-03", -60, "Food Delivery")]
        self.text = "\n".join(insights.spending_insights(self.txs, {}, 20, TODAY))

    def test_category_usual_and_trend(self):
        self.assertIn("- Food Delivery [Discretionary]: $60 | $150/mo | +50% (was $100/mo)", self.text)
        self.assertIn("- Bills [Fixed]: $0 | $1,500/mo | new", self.text)

    def test_groups_safe_to_spend_and_savings_rate(self):
        self.assertIn("- Fixed: $0 so far (usual month: $1,500)", self.text)
        # 4000 - 1500 fixed - 0 essentials - 800 savings = 1700 for wants;
        # 60 spent before today, 10 days left (Oct 22–31) → $164/day.
        self.assertIn("Safe to spend on discretionary today: $164", self.text)
        self.assertIn("- Sep 2026: income $4,000, spent $1,650, kept 59%", self.text)

    def test_top_merchants_group_store_numbers(self):
        self.assertIn("- Doordash (Food Delivery): $450 over 3 visits, avg $150", self.text)

    def test_user_kind_overrides_default(self):
        text = "\n".join(insights.spending_insights(self.txs, {"Bills": "essential"}, 20, TODAY))
        self.assertIn("- Bills [Essentials]", text)


if __name__ == "__main__":
    unittest.main()
