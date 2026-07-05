import type { ParsedCsvTransaction } from "@/types";

export interface SubscriptionCandidate {
  name: string;
  amount: number;
  occurrences: number;
  lastDate: string;
}

/**
 * Flag recurring charges: same normalized merchant + same amount appearing
 * 2+ times in an import batch — likely a subscription.
 */
export function detectSubscriptionCandidates(
  transactions: ParsedCsvTransaction[]
): SubscriptionCandidate[] {
  const groups = new Map<string, ParsedCsvTransaction[]>();

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const merchant = t.description
      .toUpperCase()
      .replace(/[#*\d]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = `${merchant}|${Math.abs(t.amount).toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  // One candidate per merchant: if several amounts recur (e.g. groceries),
  // keep the strongest signal so the list has no duplicate names.
  const byMerchant = new Map<string, SubscriptionCandidate>();
  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;
    const [merchant, amount] = key.split("|");
    const dates = txs.map((t) => t.date).sort();
    const candidate: SubscriptionCandidate = {
      name: toTitleCase(merchant),
      amount: Number.parseFloat(amount),
      occurrences: txs.length,
      lastDate: dates[dates.length - 1],
    };
    const existing = byMerchant.get(merchant);
    if (!existing || candidate.occurrences > existing.occurrences) {
      byMerchant.set(merchant, candidate);
    }
  }
  return [...byMerchant.values()].sort(
    (a, b) => b.occurrences - a.occurrences
  );
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
