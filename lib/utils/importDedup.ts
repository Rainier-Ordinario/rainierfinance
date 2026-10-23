export interface DedupRow {
  date: string;
  description: string;
  amount: number;
  account_id?: string | null;
  split_group?: string | null;
  split_original_amount?: number | null;
}

/** Identity used for duplicate detection on re-import. */
export function importDupKey(row: DedupRow): string {
  return `${row.account_id ?? ""}|${row.date}|${row.description}|${Number(
    row.amount
  ).toFixed(2)}`;
}

/**
 * How many times each bank row already exists. The rows of a split count
 * once, under the bank's original amount, so re-importing a statement
 * doesn't bring the unsplit original back.
 */
export function existingImportCounts(existing: DedupRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  const seenGroups = new Set<string>();
  for (const e of existing) {
    let row = e;
    if (e.split_group) {
      if (seenGroups.has(e.split_group)) continue;
      seenGroups.add(e.split_group);
      row = { ...e, amount: Number(e.split_original_amount ?? e.amount) };
    }
    const key = importDupKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Split the incoming rows into new ones and already-imported duplicates. */
export function dedupeImport<T extends DedupRow>(
  rows: T[],
  existing: DedupRow[]
): { toInsert: T[]; skipped: number } {
  const counts = existingImportCounts(existing);
  const toInsert: T[] = [];
  let skipped = 0;
  for (const row of rows) {
    const key = importDupKey(row);
    const remaining = counts.get(key) ?? 0;
    if (remaining > 0) {
      counts.set(key, remaining - 1);
      skipped++;
    } else {
      toInsert.push(row);
    }
  }
  return { toInsert, skipped };
}

// ---------- Splits ----------

export interface SplitPart {
  category: string;
  /** Positive size of this part. */
  amount: number;
}

/** Cents, to compare money without float drift. */
const cents = (x: number) => Math.round(x * 100);

/**
 * Check a split: at least two positive parts that add up exactly to the
 * original amount. Returns an error message, or null when valid.
 */
export function splitError(originalAmount: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return "Split into at least two parts.";
  if (parts.some((p) => !p.category)) return "Pick a category for each part.";
  if (parts.some((p) => !(p.amount > 0))) return "Each part needs an amount above $0.";
  const diff = cents(Math.abs(originalAmount)) - parts.reduce((s, p) => s + cents(p.amount), 0);
  if (diff !== 0) {
    return `Parts must add up to the original — ${diff > 0 ? "$" + (diff / 100).toFixed(2) + " left" : "$" + (-diff / 100).toFixed(2) + " over"}.`;
  }
  return null;
}
