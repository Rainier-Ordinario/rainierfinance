"""Spending insights for the AI Advisor's context.

Mirrors the calculations the web app shows (lib/utils/spending.ts and
lib/utils/budgets.ts) so the advisor quotes the same numbers the user sees:
"usual" is the average of the last 3 complete months, categories fall into
fixed / essential / discretionary groups, and budgets are measured live
from transactions rather than the stale spent_amount column.

Every function here is pure (dicts in, values out) so it can be unit-tested
without Supabase.
"""

import re
from calendar import monthrange
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

# Keep in sync with DEFAULT_KINDS in lib/utils/spending.ts.
DEFAULT_KINDS = {
    "Bills": "fixed",
    "Subscriptions": "fixed",
    "Streaming": "fixed",
    "Education": "fixed",
    "Rent": "fixed",
    "Housing": "fixed",
    "Mortgage": "fixed",
    "Insurance": "fixed",
    "Utilities": "fixed",
    "Phone": "fixed",
    "Internet": "fixed",
    "Groceries": "essential",
    "Gas": "essential",
    "Transit": "essential",
    "Health": "essential",
    "Pharmacy": "essential",
    "Parking": "essential",
}
KIND_LABELS = {"fixed": "Fixed", "essential": "Essentials", "discretionary": "Discretionary"}
UNCATEGORIZED = "Other"
DEFAULT_SAVINGS_TARGET_PCT = 20.0


# ---------- Small helpers ----------


def money(value: float) -> str:
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.0f}"


def magnitude(t: dict[str, Any]) -> float:
    try:
        return abs(float(t["amount"]))
    except (KeyError, TypeError, ValueError):
        return 0.0


def merchant_key(description: str) -> str:
    """Same normalization as merchantKey() in lib/utils/categorize.ts."""
    s = description.lower()
    s = re.sub(r"[#*]?\d+", "", s)
    s = re.sub(r"[^a-z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def month_start(d: date, months_back: int = 0) -> date:
    y, m = d.year, d.month - months_back
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def month_end(d: date) -> date:
    return date(d.year, d.month, monthrange(d.year, d.month)[1])


def category_kind(name: str, kinds: dict[str, str]) -> str:
    return kinds.get(name) or DEFAULT_KINDS.get(name) or "discretionary"


def in_range(t: dict[str, Any], start: date, end: date) -> bool:
    return start.isoformat() <= t["date"] <= end.isoformat()


def expenses(txs: list[dict[str, Any]], start: date, end: date) -> list[dict[str, Any]]:
    return [t for t in txs if t.get("type") == "expense" and in_range(t, start, end)]


def income_total(txs: list[dict[str, Any]], start: date, end: date) -> float:
    return sum(
        magnitude(t) for t in txs if t.get("type") == "income" and in_range(t, start, end)
    )


def by_category(txs: list[dict[str, Any]]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for t in txs:
        totals[t.get("category") or UNCATEGORIZED] += magnitude(t)
    return totals


def by_kind(txs: list[dict[str, Any]], kinds: dict[str, str]) -> dict[str, float]:
    totals = {"fixed": 0.0, "essential": 0.0, "discretionary": 0.0}
    for t in txs:
        totals[category_kind(t.get("category") or "", kinds)] += magnitude(t)
    return totals


# ---------- Budgets ----------


def budget_period(budget: dict[str, Any], today: date) -> tuple[date, date]:
    """Same windows as budgetPeriodRange() in lib/utils/budgets.ts."""
    period = budget.get("period")
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    if period == "yearly":
        return date(today.year, 1, 1), date(today.year, 12, 31)
    if period == "custom":
        start = date.fromisoformat(budget["start_date"]) if budget.get("start_date") else month_start(today)
        end = date.fromisoformat(budget["end_date"]) if budget.get("end_date") else month_end(today)
        return start, end
    return month_start(today), month_end(today)


def budget_lines(budgets: list[dict[str, Any]], txs: list[dict[str, Any]], today: date) -> list[str]:
    lines = []
    for b in budgets:
        start, end = budget_period(b, today)
        category = b.get("category")
        spent = sum(
            magnitude(t) for t in expenses(txs, start, end) if t.get("category") == category
        ) if category else 0.0
        total = float(b.get("total_amount") or 0)
        days_total = (end - start).days + 1
        elapsed = min(max((today - start).days + 1, 1), days_total)
        projected = spent / elapsed * days_total
        status = "over" if spent >= total > 0 else "on pace to go over" if projected > total else "on track"
        lines.append(
            f"- {b['name']} ({b.get('period') or 'monthly'}, {category or 'no category'}): "
            f"spent {money(spent)} of {money(total)} for {start.isoformat()} to {end.isoformat()}, "
            f"{(end - today).days} days left, projected {money(projected)} — {status}"
        )
    return lines


# ---------- Spending insights ----------


def spending_insights(
    txs: list[dict[str, Any]],
    kinds: dict[str, str],
    savings_target_pct: float,
    today: date,
) -> list[str]:
    """Render the computed insights as markdown lines for the model."""
    lines: list[str] = []
    this_start = month_start(today)
    days_in_month = monthrange(today.year, today.month)[1]
    usual_start = month_start(today, 3)
    usual_end = this_start - timedelta(days=1)
    prior_start = month_start(today, 6)
    prior_end = usual_start - timedelta(days=1)

    now_exp = expenses(txs, this_start, today)
    usual_exp = expenses(txs, usual_start, usual_end)
    prior_exp = expenses(txs, prior_start, prior_end)

    # Month so far vs usual, by group
    lines.append(
        f"### This month so far ({this_start.isoformat()} to {today.isoformat()}, "
        f"day {today.day} of {days_in_month})"
    )
    income_now = income_total(txs, this_start, today)
    income_usual = income_total(txs, usual_start, usual_end) / 3
    lines.append(f"- Income: {money(income_now)} (usual month: {money(income_usual)})")
    kinds_now = by_kind(now_exp, kinds)
    kinds_usual = by_kind(usual_exp, kinds)
    for k in ("fixed", "essential", "discretionary"):
        lines.append(
            f"- {KIND_LABELS[k]}: {money(kinds_now[k])} so far (usual month: {money(kinds_usual[k] / 3)})"
        )

    # Safe to spend today
    expected_income = max(income_now, income_usual)
    if expected_income > 0:
        expected_fixed = max(kinds_now["fixed"], kinds_usual["fixed"] / 3)
        expected_essential = max(kinds_now["essential"], kinds_usual["essential"] / 3)
        savings = expected_income * savings_target_pct / 100
        wants_budget = expected_income - expected_fixed - expected_essential - savings
        spent_today = by_kind(expenses(txs, today, today), kinds)["discretionary"]
        before_today = kinds_now["discretionary"] - spent_today
        days_left = days_in_month - today.day + 1
        daily = max(0.0, (wants_budget - before_today) / days_left)
        lines.append(
            f"- Safe to spend on discretionary today: {money(daily)} "
            f"(wants budget this month {money(wants_budget)} = expected income {money(expected_income)} "
            f"- fixed {money(expected_fixed)} - essentials {money(expected_essential)} "
            f"- savings goal {savings_target_pct:g}% {money(savings)}; "
            f"{money(wants_budget - kinds_now['discretionary'])} left over {days_left} days)"
        )

    # Categories: this month, usual, and 3-month trend
    lines.append(
        "\n### Spending by category "
        "(this month so far | usual month = avg of last 3 complete months | trend vs the 3 months before)"
    )
    cat_now = by_category(now_exp)
    cat_usual = by_category(usual_exp)
    cat_prior = by_category(prior_exp)
    names = sorted(set(cat_now) | set(cat_usual), key=lambda c: -(cat_usual.get(c, 0) + cat_now.get(c, 0)))
    for c in names:
        usual = cat_usual.get(c, 0) / 3
        prior = cat_prior.get(c, 0) / 3
        if prior > 0:
            change = (usual - prior) / prior * 100
            trend = f"{change:+.0f}% (was {money(prior)}/mo)"
        else:
            trend = "new"
        lines.append(
            f"- {c} [{KIND_LABELS[category_kind(c, kinds)]}]: {money(cat_now.get(c, 0))} | "
            f"{money(usual)}/mo | {trend}"
        )

    # Top merchants
    merchants: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for t in usual_exp:
        key = merchant_key(t.get("description") or "")
        if key:
            merchants[key].append(t)
    ranked = sorted(merchants.items(), key=lambda kv: -sum(magnitude(t) for t in kv[1]))
    lines.append(
        f"\n### Top merchants ({usual_start.isoformat()} to {usual_end.isoformat()}, 3 months)"
    )
    for key, mtxs in ranked[:15]:
        total = sum(magnitude(t) for t in mtxs)
        category = Counter(t.get("category") for t in mtxs).most_common(1)[0][0]
        lines.append(
            f"- {key.title()} ({category}): {money(total)} over {len(mtxs)} visits, "
            f"avg {money(total / len(mtxs))}"
        )

    # Savings rate by month
    lines.append("\n### Savings rate by month ((income - spending) / income; transfers excluded)")
    for back in range(6, 0, -1):
        start = month_start(today, back)
        end = month_end(start)
        inc = income_total(txs, start, end)
        spent = sum(magnitude(t) for t in expenses(txs, start, end))
        rate = f"{(inc - spent) / inc * 100:.0f}%" if inc > 0 else "no income"
        lines.append(f"- {start.strftime('%b %Y')}: income {money(inc)}, spent {money(spent)}, kept {rate}")

    # Uncategorized
    window_start = today - timedelta(days=90)
    recent = expenses(txs, window_start, today)
    total_recent = sum(magnitude(t) for t in recent)
    stuck = sum(magnitude(t) for t in recent if (t.get("category") or UNCATEGORIZED) == UNCATEGORIZED)
    if total_recent > 0 and stuck > 0:
        lines.append(
            f"\n- Uncategorized ('Other') spending in the last 90 days: {money(stuck)} "
            f"({stuck / total_recent * 100:.0f}% of spending) — category figures undercount by this much."
        )

    return lines
