import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { budgetProgress } from "@/lib/utils/budgets";
import { challengeProgress } from "@/lib/utils/challenges";
import { formatCADWhole } from "@/lib/utils/currency";
import { daysUntil, toISODate } from "@/lib/utils/dates";
import { knownMerchantsFrom, looksLikeRefund, type MerchantRules } from "@/lib/utils/categorize";
import { safeToSpend, uncategorizedSummary } from "@/lib/utils/spending";
import { subscriptionHealth } from "@/lib/utils/subscriptions";
import type {
  Budget,
  Category,
  Challenge,
  Subscription,
  Transaction,
} from "@/types";

export type AlertSeverity = "high" | "medium" | "info";

export interface Alert {
  /** Stable per situation and period, so a dismissal sticks until it changes. */
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  href: string;
}

export interface AlertInputs {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  subscriptions: Subscription[];
  challenges: Challenge[];
  rules: MerchantRules;
  savingsTargetPct: number;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { high: 0, medium: 1, info: 2 };

/**
 * Everything worth a nudge right now, most urgent first: budgets over or
 * heading over, wants over budget, challenges slipping, subscription
 * renewals and price rises, and data that needs tidying.
 */
export function buildAlerts(inputs: AlertInputs, now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const month = format(now, "yyyy-MM");

  for (const b of inputs.budgets) {
    if (!b.category) continue;
    const p = budgetProgress(b, inputs.transactions, now);
    if (p.status === "over") {
      alerts.push({
        id: `budget-over:${b.id}:${month}`,
        severity: "high",
        title: `${b.name} is ${formatCADWhole(-p.remaining)} over budget`,
        detail: `${formatCADWhole(p.spent)} of ${formatCADWhole(Number(b.total_amount))} with ${p.daysLeft} days left`,
        href: "/budgets",
      });
    } else if (p.status === "watch") {
      alerts.push({
        id: `budget-watch:${b.id}:${month}`,
        severity: "medium",
        title: `${b.name} is on pace to go over`,
        detail: `Heading for ${formatCADWhole(p.projected)} of ${formatCADWhole(Number(b.total_amount))}`,
        href: "/budgets",
      });
    }
  }

  const safe = safeToSpend(
    inputs.transactions,
    inputs.categories,
    inputs.savingsTargetPct,
    now
  );
  if (safe && safe.remaining < 0) {
    alerts.push({
      id: `wants-over:${month}`,
      severity: "high",
      title: `Wants are ${formatCADWhole(-safe.remaining)} over this month`,
      detail: "Further discretionary spending comes out of your savings goal.",
      href: "/dashboard",
    });
  }

  for (const c of inputs.challenges) {
    if (c.month !== toISODate(new Date(now.getFullYear(), now.getMonth(), 1))) continue;
    const p = challengeProgress(c, inputs.transactions, inputs.categories, now);
    if (p.status !== "at_risk") continue;
    alerts.push({
      id: `challenge-risk:${c.id}`,
      severity: "medium",
      title:
        c.kind === "category_cap"
          ? `${c.category} challenge at risk`
          : "No-spend challenge at risk",
      detail:
        c.kind === "category_cap"
          ? `On pace for ${formatCADWhole(p.projected ?? 0)} against a ${formatCADWhole(p.target)} cap`
          : `${p.value} of ${p.target} days, ${p.daysLeft} left`,
      href: "/goals",
    });
  }

  for (const s of inputs.subscriptions) {
    if (s.status !== "active") continue;
    const days = daysUntil(s.next_billing_date, now);
    if (days >= 0 && days <= 2) {
      alerts.push({
        id: `renews:${s.id}:${s.next_billing_date}`,
        severity: "info",
        title: `${s.name} renews ${days === 0 ? "today" : days === 1 ? "tomorrow" : "in 2 days"}`,
        detail: formatCADWhole(Number(s.amount)),
        href: "/subscriptions",
      });
    }
    const health = subscriptionHealth(s, inputs.transactions, now);
    if (
      health.priceChange &&
      health.priceChange.to > health.priceChange.from &&
      differenceInCalendarDays(now, parseISO(health.priceChange.date)) <= 45
    ) {
      alerts.push({
        id: `price-up:${s.id}:${health.priceChange.date}`,
        severity: "medium",
        title: `${s.name} went up to ${formatCADWhole(health.priceChange.to)}`,
        detail: `Was ${formatCADWhole(health.priceChange.from)}. Still worth it?`,
        href: "/subscriptions",
      });
    }
  }

  const known = knownMerchantsFrom(inputs.transactions);
  const refunds = inputs.transactions.filter(
    (t) => t.type === "income" && looksLikeRefund(t.description, known, inputs.rules)
  ).length;
  if (refunds > 0) {
    alerts.push({
      id: `refunds:${refunds}`,
      severity: "info",
      title: `${refunds} ${refunds === 1 ? "credit looks" : "credits look"} like refunds`,
      detail: "Counted as income right now.",
      href: "/transactions",
    });
  }

  const stuck = uncategorizedSummary(inputs.transactions, 90, now);
  if (stuck.count > 0 && stuck.share >= 3) {
    alerts.push({
      id: `uncategorized:${month}`,
      severity: "info",
      title: `${stuck.count} transactions need a category`,
      detail: `${formatCADWhole(stuck.amount)} (${Math.round(stuck.share)}%) of recent spending`,
      href: `/transactions?${new URLSearchParams({ type: "expense", category: "Other", from: stuck.start, to: stuck.end })}`,
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
