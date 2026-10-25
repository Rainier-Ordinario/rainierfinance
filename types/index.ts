// Domain types mirroring supabase/migrations/001_initial_schema.sql.
// Replaceable later with `supabase gen types typescript` output.

export type AccountType =
  | "chequing"
  | "savings"
  | "credit_card"
  | "tfsa"
  | "fhsa"
  | "crypto"
  | "investment";

export type TransactionType = "expense" | "income" | "transfer";
export type CategoryType = "expense" | "income" | "both";
export type CategoryKind = "fixed" | "essential" | "discretionary";
export type BillingCycle = "monthly" | "yearly" | "weekly";
export type SubscriptionStatus = "active" | "cancelled" | "paused";
export type BudgetPeriod = "monthly" | "weekly" | "yearly" | "custom";
export type RegisteredAccountType = "TFSA" | "FHSA" | "RRSP" | "Non-Registered";
export type AssetType = "ETF" | "EQUITY" | "CRYPTO";
export type ChatRole = "user" | "assistant";
export type AutopayType = "minimum" | "full_balance" | "fixed";
export type ChallengeKind = "category_cap" | "no_spend_days";

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number;
  target_date: string | null;
  /** Manual progress; ignored when account_id links a balance. */
  saved_amount: number;
  account_id: string | null;
  created_at: string;
}

export interface Challenge {
  id: string;
  user_id: string;
  kind: ChallengeKind;
  category: string | null;
  /** Dollar cap (category_cap) or number of days (no_spend_days). */
  target: number;
  /** First day of the challenge's month. */
  month: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  credit_limit: number | null;
  currency: string;
  color: string;
  account_number_last4: string | null;
  is_active: boolean;
  /** The bank connection this account syncs from (migration 008). */
  plaid_item_id?: string | null;
  plaid_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type PlaidItemStatus = "active" | "login_required" | "error";

/** A linked bank login (migration 008). Its access token is server-only. */
export interface PlaidItem {
  id: string;
  user_id: string;
  item_id: string;
  institution_id: string | null;
  institution_name: string;
  cursor: string | null;
  status: PlaidItemStatus;
  error_code: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string | null;
  date: string;
  type: TransactionType;
  is_recurring: boolean;
  notes: string | null;
  /** Rows split from one bank transaction share this id (migration 007). */
  split_group?: string | null;
  /** The bank's original amount for a split row, for re-import matching. */
  split_original_amount?: number | null;
  /** Set on rows synced from the bank (migration 008). */
  plaid_transaction_id?: string | null;
  /** Not yet posted by the bank; the amount may still change. */
  pending?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType | null;
  /** Null (or absent before migration 005) → name-based default. */
  kind?: CategoryKind | null;
  is_default: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle | null;
  next_billing_date: string;
  category: string | null;
  status: SubscriptionStatus;
  logo_url: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  total_amount: number;
  spent_amount: number;
  period: BudgetPeriod | null;
  start_date: string | null;
  end_date: string | null;
  category: string | null;
  color: string;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  account_id: string | null;
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
  account_type: RegisteredAccountType | null;
  asset_type: AssetType | null;
  currency: string;
  last_updated: string;
  created_at: string;
}

export interface CryptoHolding {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_cost_cad: number;
  current_price_cad: number | null;
  market_value_cad: number | null;
  unrealized_gain_cad: number | null;
  unrealized_gain_pct: number | null;
  last_updated: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface PaymentReminder {
  id: string;
  user_id: string;
  account_id: string | null;
  statement_close_date: number | null;
  due_date: number | null;
  autopay_enabled: boolean;
  autopay_type: AutopayType | null;
  created_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  account_balances: Record<string, number>;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  notes: string | null;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  avion_points_balance: number;
  dry_powder_amount: number;
  dry_powder_account_id: string | null;
  /** Normalized merchant keys the user dismissed from detection. */
  dismissed_recurring: string[] | null;
  /** Learned merchantKey → category overrides (migration 005). */
  merchant_rules?: Record<string, string> | null;
  /** Percent of income to save (migration 006). */
  savings_target_pct?: number | null;
  updated_at: string;
}

// ---------- Derived / UI types ----------

export type UtilizationStatus = "excellent" | "good" | "warning" | "danger";

export interface UtilizationResult {
  percentage: number;
  status: UtilizationStatus;
  color: string;
}

export interface ParsedCsvTransaction {
  date: string; // ISO yyyy-MM-dd
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  accountLast4?: string;
}

export interface ParsedHolding {
  symbol: string;
  name: string;
  quantity: number;
  average_cost: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
  asset_type: AssetType;
  /** Present when the export names the account (real Wealthsimple reports). */
  account_type?: RegisteredAccountType;
}

export interface FinancialContext {
  net_worth: number;
  monthly_income: number;
  monthly_expenses: number;
  savings_rate: number;
  cards: Array<{
    name: string;
    balance: number;
    limit: number;
    utilization: number;
  }>;
  combined_utilization: number;
  tfsa_value: number;
  fhsa_value: number;
  top_holdings: Array<{ symbol: string; weight_pct: number }>;
  crypto_value: number;
  cash_value: number;
  dry_powder: number;
  top_categories: Array<{ category: string; amount: number }>;
  upcoming_subscriptions: Array<{
    name: string;
    amount: number;
    next_billing_date: string;
  }>;
}
