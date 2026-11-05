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

/**
 * Words and reference numbers in a description, for matching the same
 * transaction across RBC's download formats, which word it differently
 * ("BONUS DEPOSIT INTEREST" vs "BONUS DEP INT", or a trailing province).
 */
/** RBC's short download format abbreviates; expand to the long format's words. */
const RBC_ABBREVIATIONS: Record<string, string> = {
  trf: "transfer",
  trfs: "transfer",
  reqful: "fulfilled",
  dep: "deposit",
  int: "interest",
  dda: "deposit",
};

function descriptionTokens(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((t) => RBC_ABBREVIATIONS[t] ?? t)
      .filter((t) => t.length >= 3)
  );
}

function sharesToken(a: string, b: string): boolean {
  const tokens = descriptionTokens(a);
  for (const t of descriptionTokens(b)) if (tokens.has(t)) return true;
  return false;
}

/** Account + date + amount: identical across formats even when the wording isn't. */
function looseDupKey(row: DedupRow): string {
  return `${row.account_id ?? ""}|${row.date}|${Number(row.amount).toFixed(2)}`;
}

/**
 * Split the incoming rows into new ones and already-imported duplicates.
 * A row matches an existing one with the same description, or failing
 * that, one on the same account, day and amount whose description shares
 * a word or reference number. Each existing row matches at most once.
 */
export function dedupeImport<T extends DedupRow>(
  rows: T[],
  existing: DedupRow[]
): { toInsert: T[]; skipped: number } {
  const counts = existingImportCounts(existing);
  const unmatched: T[] = [];
  let skipped = 0;
  for (const row of rows) {
    const key = importDupKey(row);
    const remaining = counts.get(key) ?? 0;
    if (remaining > 0) {
      counts.set(key, remaining - 1);
      skipped++;
    } else {
      unmatched.push(row);
    }
  }

  // Existing rows not claimed by an exact match, by account/day/amount.
  const leftovers = new Map<string, string[]>();
  const seenGroups = new Set<string>();
  for (const e of existing) {
    let row = e;
    if (e.split_group) {
      if (seenGroups.has(e.split_group)) continue;
      seenGroups.add(e.split_group);
      row = { ...e, amount: Number(e.split_original_amount ?? e.amount) };
    }
    const exact = importDupKey(row);
    const left = counts.get(exact) ?? 0;
    if (left === 0) continue;
    counts.set(exact, left - 1);
    const loose = looseDupKey(row);
    leftovers.set(loose, [...(leftovers.get(loose) ?? []), row.description]);
  }

  const toInsert: T[] = [];
  for (const row of unmatched) {
    const candidates = leftovers.get(looseDupKey(row)) ?? [];
    const i = candidates.findIndex((d) => sharesToken(d, row.description));
    if (i >= 0) {
      candidates.splice(i, 1);
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
