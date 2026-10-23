import {
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarMonths,
  parseISO,
  startOfDay,
} from "date-fns";
import { merchantKey } from "@/lib/utils/categorize";
import { toISODate } from "@/lib/utils/dates";
import type { Subscription, Transaction } from "@/types";

/** Normalize any billing cycle to a monthly cost. */
export function monthlyAmount(sub: Subscription): number {
  const amount = Number(sub.amount);
  switch (sub.billing_cycle) {
    case "yearly":
      return amount / 12;
    case "weekly":
      return (amount * 52) / 12;
    default:
      return amount;
  }
}

/**
 * The next billing date on or after today. A stored date that has already
 * passed means the charge went through, so step it forward by the billing
 * cycle (monthly when unset) until it's upcoming again. Steps are counted
 * from the stored date so month-end anchors don't drift (Jan 31 → Mar 31,
 * not Mar 28). Only active subscriptions renew.
 */
export function rolledBillingDate(sub: Subscription, now = new Date()): string {
  if (sub.status !== "active") return sub.next_billing_date;
  const anchor = parseISO(sub.next_billing_date);
  const today = startOfDay(now);
  const step = (n: number) => {
    switch (sub.billing_cycle) {
      case "weekly":
        return addWeeks(anchor, n);
      case "yearly":
        return addYears(anchor, n);
      default:
        return addMonths(anchor, n);
    }
  };
  let n = 0;
  let next = anchor;
  while (next < today) next = step(++n);
  return toISODate(next);
}

/** Known service domains where a naive name→domain guess would miss. */
const KNOWN_DOMAINS: Record<string, string> = {
  "icloud+": "apple.com",
  icloud: "apple.com",
  "amazon prime": "amazon.ca",
  "youtube premium": "youtube.com",
  "chatgpt plus": "openai.com",
  chatgpt: "openai.com",
  crave: "crave.ca",
  "goodlife fitness": "goodlifefitness.com",
  "the athletic": "theathletic.com",
  "disney+": "disneyplus.com",
};

/**
 * Best-effort logo via the Google favicon service (Clearbit's logo API is
 * sunset). Callers render an initials avatar on load error.
 */
export function subscriptionLogoUrl(name: string): string {
  const key = name.trim().toLowerCase();
  const domain =
    KNOWN_DOMAINS[key] ?? `${key.replace(/[^a-z0-9]/g, "")}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export interface DetectedSubscription {
  /** Normalized merchant key — stable id used to persist dismissals. */
  key: string;
  name: string;
  amount: number;
  category: string | null;
  account_id: string | null;
  next_billing_date: string;
  occurrences: number;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Everyday-errand categories: merchants here repeat because people shop and
 * eat, not because they're billed on a schedule.
 */
const NON_SUBSCRIPTION_CATEGORIES = new Set(["Dining", "Gas", "Groceries"]);

/**
 * Find recurring monthly charges in transaction history that aren't tracked
 * as subscriptions yet: same normalized description, similar amount (±15%),
 * charged in at least 3 distinct months, excluding everyday-errand
 * categories.
 */
export function detectRecurringCharges(
  transactions: Transaction[],
  subscriptions: Subscription[]
): DetectedSubscription[] {
  const known = subscriptions.map((s) => merchantKey(s.name));
  const groups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    // Purchases only: a refund isn't a charge.
    if (t.type !== "expense" || Number(t.amount) > 0) continue;
    if (t.category && NON_SUBSCRIPTION_CATEGORIES.has(t.category)) continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const detected: DetectedSubscription[] = [];
  for (const [key, txs] of groups) {
    if (known.some((k) => k.includes(key) || key.includes(k))) continue;

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(sorted.map((t) => t.date.slice(0, 7)));
    if (months.size < 3) continue;

    // Charges are stored negative — compare magnitudes.
    const amounts = sorted.map((t) => Math.abs(Number(t.amount)));
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min <= 0 || (max - min) / min > 0.15) continue;

    // Must recur roughly monthly, not just twice a year apart
    const first = parseISO(sorted[0].date);
    const last = parseISO(sorted[sorted.length - 1].date);
    const span = differenceInCalendarMonths(last, first);
    if (span + 1 > months.size + 1) continue;

    const latest = sorted[sorted.length - 1];
    detected.push({
      key,
      name: titleCase(key),
      amount: Math.abs(Number(latest.amount)),
      category: latest.category || null,
      account_id: latest.account_id,
      next_billing_date: toISODate(addMonths(parseISO(latest.date), 1)),
      occurrences: sorted.length,
    });
  }

  return detected.sort((a, b) => b.occurrences - a.occurrences);
}
