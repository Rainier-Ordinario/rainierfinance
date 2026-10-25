import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import {
  categorizeMerchant,
  classifyRefunds,
  type KnownMerchants,
  type MerchantRules,
} from "@/lib/utils/categorize";
import { rbcTransferKind } from "@/lib/parsers/rbc-csv";
import type { AccountType, TransactionType } from "@/types";

/** Our account type for a Plaid account, or null for ones we don't track (loans). */
export function appAccountType(
  account: Pick<AccountBase, "type" | "subtype">
): AccountType | null {
  const subtype = account.subtype ?? "";
  switch (account.type) {
    case "depository":
      return subtype === "savings" ? "savings" : "chequing";
    case "credit":
      return "credit_card";
    case "investment":
    case "brokerage":
      if (subtype === "tfsa") return "tfsa";
      if (subtype === "fhsa") return "fhsa";
      if (subtype === "crypto exchange") return "crypto";
      return "investment";
    default:
      return null;
  }
}

/**
 * Plaid's detailed categories that are money moving between the user's own
 * accounts. Transfers to and from other people stay income and spending.
 */
const TRANSFER_DETAILED = new Set([
  "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "TRANSFER_IN_ACCOUNT_TRANSFER",
  "TRANSFER_IN_SAVINGS",
  "TRANSFER_OUT_ACCOUNT_TRANSFER",
  "TRANSFER_OUT_SAVINGS",
]);
const INVESTMENT_DETAILED = new Set([
  "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
]);

/** Plaid category → one of the app's default categories, most specific first. */
const PLAID_CATEGORIES: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK: "Dining",
  TRANSPORTATION_GAS: "Gas",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Rideshare",
  TRANSPORTATION: "Transit",
  ENTERTAINMENT_TV_AND_MOVIES: "Streaming",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Streaming",
  ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Shopping",
  RENT_AND_UTILITIES: "Bills",
  BANK_FEES: "Bills",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  GENERAL_SERVICES_EDUCATION: "Education",
};

function plaidCategory(tx: PlaidTransaction): string | null {
  const pfc = tx.personal_finance_category;
  if (!pfc) return null;
  return PLAID_CATEGORIES[pfc.detailed] ?? PLAID_CATEGORIES[pfc.primary] ?? null;
}

export interface MappedTransaction {
  plaid_transaction_id: string;
  plaid_account_id: string;
  pending: boolean;
  date: string;
  description: string;
  /** Negative for money out, like every other row in the app. */
  amount: number;
  category: string;
  type: TransactionType;
}

/** Classify one Plaid transaction with the same rules a CSV import uses. */
export function mapPlaidTransaction(
  tx: PlaidTransaction,
  rules: MerchantRules
): MappedTransaction {
  // Plaid reports money out as positive; the app stores it negative.
  const amount = -tx.amount;
  const description = tx.name || tx.merchant_name || "Transaction";
  const detailed = tx.personal_finance_category?.detailed ?? "";
  const base = {
    plaid_transaction_id: tx.transaction_id,
    plaid_account_id: tx.account_id,
    pending: tx.pending,
    // The purchase date matches what the bank statement (and a CSV) shows;
    // `date` is when it posted.
    date: tx.authorized_date ?? tx.date,
    description,
    amount,
  };

  const transferKind =
    rbcTransferKind(description) ??
    (TRANSFER_DETAILED.has(detailed)
      ? "transfer"
      : INVESTMENT_DETAILED.has(detailed)
        ? "investment"
        : null);
  if (transferKind) {
    return {
      ...base,
      category: transferKind === "transfer" ? "Transfer" : "Investments",
      type: "transfer",
    };
  }
  if (amount > 0) return { ...base, category: "Income", type: "income" };

  let category = categorizeMerchant(description, rules);
  if (category === "Other" && tx.merchant_name) {
    category = categorizeMerchant(tx.merchant_name, rules);
  }
  if (category === "Other") category = plaidCategory(tx) ?? "Other";
  return { ...base, category, type: "expense" };
}

/** Map a batch, then turn credits that look like refunds into refunds. */
export function mapPlaidTransactions(
  txs: PlaidTransaction[],
  rules: MerchantRules,
  knownMerchants: KnownMerchants
): MappedTransaction[] {
  return classifyRefunds(
    txs.map((tx) => mapPlaidTransaction(tx, rules)),
    knownMerchants,
    rules
  );
}

/**
 * Drop Plaid rows an account's CSV history already covers. Rows before
 * `syncFrom` are skipped; on `syncFrom` itself (the last CSV day, which
 * may have been exported midway) rows whose amount is already recorded
 * that day are skipped, counting repeats.
 */
export function dropCsvOverlap<T extends { date: string; amount: number }>(
  rows: T[],
  syncFrom: string | null,
  existingAmountsOnSyncFrom: number[]
): T[] {
  if (!syncFrom) return rows;
  const counts = new Map<string, number>();
  for (const a of existingAmountsOnSyncFrom) {
    const key = a.toFixed(2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.filter((r) => {
    if (r.date < syncFrom) return false;
    if (r.date > syncFrom) return true;
    const key = r.amount.toFixed(2);
    const remaining = counts.get(key) ?? 0;
    if (remaining === 0) return true;
    counts.set(key, remaining - 1);
    return false;
  });
}
