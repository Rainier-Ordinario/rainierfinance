/**
 * Seed script: fills a user's account with ~3 months of realistic CAD demo
 * data. Runs against the hosted Supabase project with the service-role key
 * (bypasses RLS). Idempotent — wipes the target user's rows first.
 *
 * Usage:
 *   npm run seed -- --email you@example.com   # seed an existing signed-up user
 *   npm run seed                              # create + seed dev@rainierfinance.test
 *
 * Creating the dev user needs SEED_DEV_PASSWORD (in .env.local or the
 * environment). It is never hardcoded: this repo is public.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env.local loader (no dotenv dependency)
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service role key is under Project Settings → API keys (called “secret key” for new-style keys)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_EMAIL = "dev@rainierfinance.test";
const emailArg = process.argv.indexOf("--email");
const targetEmail =
  emailArg !== -1 ? process.argv[emailArg + 1] : DEV_EMAIL;

async function resolveUserId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  const existing = data.users.find(
    (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
  );
  if (existing) return existing.id;

  if (targetEmail !== DEV_EMAIL) {
    console.error(
      `No user with email ${targetEmail} found. Sign up in the app first, then re-run.`
    );
    process.exit(1);
  }
  const password = process.env.SEED_DEV_PASSWORD;
  if (!password || password.length < 12) {
    console.error(
      "Set SEED_DEV_PASSWORD (12+ characters) in .env.local to create the dev user."
    );
    process.exit(1);
  }
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: DEV_EMAIL,
      password,
      email_confirm: true,
    });
  if (createError) throw createError;
  console.log(`Created dev user ${DEV_EMAIL} (password from SEED_DEV_PASSWORD)`);
  return created.user.id;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number, day: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return iso(d);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

/**
 * Users who signed up before the migration (and its on-signup trigger) was
 * applied have no profile/settings/categories rows — backfill them.
 */
async function ensureProfile(userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup: ${error.message}`);
  if (profile) return;

  console.log("  no profile found (pre-migration signup) — backfilling");
  {
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, currency: "CAD" });
    if (error) throw new Error(`profiles backfill: ${error.message}`);
  }
  {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId });
    if (error) throw new Error(`user_settings backfill: ${error.message}`);
  }
  const defaults: Array<[string, string, string, string]> = [
    ["Groceries", "shopping-cart", "#10B981", "expense"],
    ["Dining", "utensils", "#F59E0B", "expense"],
    ["Food Delivery", "bike", "#F97316", "expense"],
    ["Gas", "fuel", "#EF4444", "expense"],
    ["Transit", "train-front", "#06B6D4", "expense"],
    ["Rideshare", "car", "#8B5CF6", "expense"],
    ["Streaming", "play", "#EC4899", "expense"],
    ["Subscriptions", "repeat", "#6366F1", "expense"],
    ["Shopping", "shopping-bag", "#F472B6", "expense"],
    ["Bills", "receipt", "#64748B", "expense"],
    ["Health", "heart-pulse", "#14B8A6", "expense"],
    ["Education", "graduation-cap", "#3B82F6", "expense"],
    ["Entertainment", "gamepad-2", "#A855F7", "expense"],
    ["Crypto", "bitcoin", "#F7931A", "both"],
    ["Investments", "trending-up", "#22C55E", "both"],
    ["Income", "banknote", "#10B981", "income"],
    ["Transfer", "arrow-left-right", "#94A3B8", "both"],
    ["Other", "circle-ellipsis", "#9CA3AF", "both"],
  ];
  {
    const { error } = await supabase.from("categories").insert(
      defaults.map(([name, icon, color, type]) => ({
        user_id: userId,
        name,
        icon,
        color,
        type,
        is_default: true,
      }))
    );
    if (error) throw new Error(`categories backfill: ${error.message}`);
  }
}

async function wipe(userId: string) {
  // Dependency order: children before accounts.
  const tables = [
    "payment_reminders",
    "transactions",
    "subscriptions",
    "investments",
    "crypto_holdings",
    "budgets",
    "net_worth_snapshots",
    "chat_messages",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`wipe ${table}: ${error.message}`);
  }
  {
    const { error } = await supabase
      .from("user_settings")
      .update({
        avion_points_balance: 0,
        dry_powder_amount: 0,
        dry_powder_account_id: null,
      })
      .eq("user_id", userId);
    if (error) throw new Error(`reset user_settings: ${error.message}`);
  }
  const { error } = await supabase.from("accounts").delete().eq("user_id", userId);
  if (error) throw new Error(`wipe accounts: ${error.message}`);
}

async function insert<T extends object>(
  table: string,
  rows: T[]
): Promise<Array<T & { id: string }>> {
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} rows`);
  return data as Array<T & { id: string }>;
}

async function main() {
  const userId = await resolveUserId();
  console.log(`Seeding user ${targetEmail} (${userId})`);
  await ensureProfile(userId);
  await wipe(userId);

  // ---------- Accounts ----------
  const accounts = await insert("accounts", [
    { user_id: userId, name: "RBC Advantage Chequing", type: "chequing", institution: "RBC", balance: 4820.55, account_number_last4: "4417", color: "#005DAA" },
    { user_id: userId, name: "RBC High Interest Savings", type: "savings", institution: "RBC", balance: 12500.0, account_number_last4: "8830", color: "#FEDF01" },
    { user_id: userId, name: "RBC ION+", type: "credit_card", institution: "RBC", balance: 640.8, credit_limit: 5000, account_number_last4: "2291", color: "#7C3AED" },
    { user_id: userId, name: "RBC Avion Platinum", type: "credit_card", institution: "RBC", balance: 1120.4, credit_limit: 8000, account_number_last4: "7754", color: "#0EA5E9" },
    { user_id: userId, name: "Wealthsimple TFSA", type: "tfsa", institution: "Wealthsimple", balance: 28450.0, color: "#B39DDB" },
    { user_id: userId, name: "Wealthsimple FHSA", type: "fhsa", institution: "Wealthsimple", balance: 9600.0, color: "#80CBC4" },
    { user_id: userId, name: "Coinbase", type: "crypto", institution: "Coinbase", balance: 3150.0, color: "#1652F0" },
  ]);
  const byName = Object.fromEntries(accounts.map((a) => [a.name, a.id]));
  const chequing = byName["RBC Advantage Chequing"];
  const savings = byName["RBC High Interest Savings"];
  const ion = byName["RBC ION+"];
  const platinum = byName["RBC Avion Platinum"];

  // ---------- Payment reminders ----------
  await insert("payment_reminders", [
    { user_id: userId, account_id: ion, statement_close_date: 15, due_date: 25, autopay_enabled: true, autopay_type: "full_balance" },
    { user_id: userId, account_id: platinum, statement_close_date: 15, due_date: 25, autopay_enabled: false },
  ]);

  // ---------- Transactions: 3 months of a repeating monthly pattern ----------
  type Tx = { day: number; description: string; amount: number; category: string; type: "expense" | "income" | "transfer"; account: string; recurring?: boolean };
  const monthly: Tx[] = [
    { day: 1, description: "PAYROLL DEPOSIT - ACME CORP", amount: 3450.0, category: "Income", type: "income", account: chequing, recurring: true },
    { day: 15, description: "PAYROLL DEPOSIT - ACME CORP", amount: 3450.0, category: "Income", type: "income", account: chequing, recurring: true },
    { day: 1, description: "E-TRANSFER RENT - PARKVIEW APTS", amount: 1850.0, category: "Bills", type: "expense", account: chequing, recurring: true },
    { day: 2, description: "TRANSFER TO SAVINGS", amount: 500.0, category: "Transfer", type: "transfer", account: chequing, recurring: true },
    { day: 3, description: "WEALTHSIMPLE INVESTMENTS", amount: 600.0, category: "Investments", type: "transfer", account: chequing, recurring: true },
    { day: 5, description: "BELL CANADA MOBILITY", amount: 75.14, category: "Bills", type: "expense", account: platinum, recurring: true },
    { day: 3, description: "SOBEYS #712", amount: 118.42, category: "Groceries", type: "expense", account: ion },
    { day: 10, description: "COSTCO WHOLESALE W550", amount: 214.87, category: "Groceries", type: "expense", account: ion },
    { day: 17, description: "SOBEYS #712", amount: 96.3, category: "Groceries", type: "expense", account: ion },
    { day: 24, description: "FARM BOY #29", amount: 74.85, category: "Groceries", type: "expense", account: ion },
    { day: 6, description: "PETRO-CANADA 7541", amount: 62.4, category: "Gas", type: "expense", account: ion },
    { day: 20, description: "SHELL C05821", amount: 58.15, category: "Gas", type: "expense", account: ion },
    { day: 7, description: "THE KEG STEAKHOUSE", amount: 92.6, category: "Dining", type: "expense", account: ion },
    { day: 13, description: "TIM HORTONS #3402", amount: 11.35, category: "Dining", type: "expense", account: ion },
    { day: 21, description: "UBER EATS", amount: 43.2, category: "Food Delivery", type: "expense", account: ion },
    { day: 26, description: "UBER TRIP", amount: 18.75, category: "Rideshare", type: "expense", account: ion },
    { day: 9, description: "PRESTO FARE", amount: 47.25, category: "Transit", type: "expense", account: ion },
    { day: 4, description: "NETFLIX.COM", amount: 20.99, category: "Streaming", type: "expense", account: ion, recurring: true },
    { day: 8, description: "SPOTIFY P2E4B1", amount: 12.59, category: "Streaming", type: "expense", account: ion, recurring: true },
    { day: 11, description: "APPLE.COM/BILL", amount: 4.51, category: "Subscriptions", type: "expense", account: platinum, recurring: true },
    { day: 12, description: "AMAZON.CA PRIME MEMBER", amount: 11.29, category: "Subscriptions", type: "expense", account: platinum, recurring: true },
    { day: 18, description: "GOODLIFE FITNESS", amount: 47.44, category: "Health", type: "expense", account: platinum, recurring: true },
    { day: 16, description: "AMAZON.CA MARKETPLACE", amount: 66.9, category: "Shopping", type: "expense", account: platinum },
    { day: 22, description: "WINNERS #331", amount: 84.2, category: "Shopping", type: "expense", account: platinum },
    { day: 27, description: "CINEPLEX #7113", amount: 32.5, category: "Entertainment", type: "expense", account: platinum },
    { day: 25, description: "PAYMENT - THANK YOU", amount: 950.0, category: "Transfer", type: "transfer", account: ion, recurring: true },
    { day: 25, description: "PAYMENT - THANK YOU", amount: 1100.0, category: "Transfer", type: "transfer", account: platinum, recurring: true },
  ];
  const today = new Date();
  const transactions = [];
  for (let m = 2; m >= 0; m--) {
    for (const t of monthly) {
      const date = monthsAgo(m, t.day);
      if (date > iso(today)) continue; // skip future days this month
      // small variation so months don't look copy-pasted (fixed jitter, not random)
      const jitter = t.type === "income" || t.recurring ? 0 : ((t.day * (m + 3)) % 7) - 3;
      const amount = Math.round((t.amount + jitter) * 100) / 100;
      transactions.push({
        user_id: userId,
        account_id: t.account,
        // Money out is stored negative, like imports (a positive expense
        // would read as a refund).
        amount: t.type === "income" ? amount : -amount,
        description: t.description,
        category: t.category,
        date,
        type: t.type,
        is_recurring: t.recurring ?? false,
      });
    }
  }
  await insert("transactions", transactions);

  // ---------- Subscriptions ----------
  await insert("subscriptions", [
    { user_id: userId, account_id: ion, name: "Netflix", amount: 20.99, billing_cycle: "monthly", next_billing_date: daysFromNow(4), category: "Streaming", status: "active", logo_url: null },
    { user_id: userId, account_id: ion, name: "Spotify", amount: 12.59, billing_cycle: "monthly", next_billing_date: daysFromNow(8), category: "Streaming", status: "active", logo_url: null },
    { user_id: userId, account_id: platinum, name: "iCloud+", amount: 4.51, billing_cycle: "monthly", next_billing_date: daysFromNow(11), category: "Subscriptions", status: "active", logo_url: null },
    { user_id: userId, account_id: platinum, name: "Amazon Prime", amount: 11.29, billing_cycle: "monthly", next_billing_date: daysFromNow(12), category: "Subscriptions", status: "active", logo_url: null },
    { user_id: userId, account_id: platinum, name: "GoodLife Fitness", amount: 47.44, billing_cycle: "monthly", next_billing_date: daysFromNow(18), category: "Health", status: "active", logo_url: null },
    { user_id: userId, account_id: ion, name: "Crave", amount: 22.99, billing_cycle: "monthly", next_billing_date: daysFromNow(21), category: "Streaming", status: "active", logo_url: null },
    { user_id: userId, account_id: platinum, name: "ChatGPT Plus", amount: 28.99, billing_cycle: "monthly", next_billing_date: daysFromNow(25), category: "Subscriptions", status: "active", logo_url: null },
    { user_id: userId, account_id: platinum, name: "The Athletic", amount: 71.99, billing_cycle: "yearly", next_billing_date: daysFromNow(64), category: "Subscriptions", status: "paused", logo_url: null },
  ]);

  // ---------- Investments ----------
  type Holding = { symbol: string; name: string; qty: number; cost: number; price: number; account_type: "TFSA" | "FHSA"; asset_type: "ETF" | "EQUITY" };
  const holdings: Holding[] = [
    { symbol: "VFV", name: "Vanguard S&P 500 Index ETF", qty: 85, cost: 128.4, price: 151.2, account_type: "TFSA", asset_type: "ETF" },
    { symbol: "XEQT", name: "iShares Core Equity ETF", qty: 210, cost: 29.85, price: 34.6, account_type: "TFSA", asset_type: "ETF" },
    { symbol: "QQC", name: "Invesco NASDAQ 100 Index ETF", qty: 48, cost: 138.2, price: 162.75, account_type: "TFSA", asset_type: "ETF" },
    { symbol: "ZEA", name: "BMO MSCI EAFE Index ETF", qty: 120, cost: 21.4, price: 23.1, account_type: "TFSA", asset_type: "ETF" },
    { symbol: "AMD", name: "Advanced Micro Devices", qty: 9, cost: 152.3, price: 178.4, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "NVDA", name: "NVIDIA Corp", qty: 6, cost: 122.5, price: 184.2, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "MSFT", name: "Microsoft Corp", qty: 4, cost: 410.0, price: 462.3, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "META", name: "Meta Platforms", qty: 3, cost: 495.8, price: 618.4, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "MU", name: "Micron Technology", qty: 12, cost: 98.6, price: 112.3, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "GOOG", name: "Alphabet Inc", qty: 5, cost: 168.2, price: 195.6, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "AMZN", name: "Amazon.com Inc", qty: 5, cost: 182.4, price: 208.1, account_type: "TFSA", asset_type: "EQUITY" },
    { symbol: "RY", name: "Royal Bank of Canada", qty: 20, cost: 134.5, price: 172.8, account_type: "FHSA", asset_type: "EQUITY" },
    { symbol: "CNR", name: "Canadian National Railway", qty: 18, cost: 158.9, price: 149.2, account_type: "FHSA", asset_type: "EQUITY" },
    { symbol: "POW", name: "Power Corp of Canada", qty: 40, cost: 38.7, price: 44.9, account_type: "FHSA", asset_type: "EQUITY" },
  ];
  await insert(
    "investments",
    holdings.map((h) => {
      const market_value = Math.round(h.qty * h.price * 100) / 100;
      const book = h.qty * h.cost;
      const unrealized_gain = Math.round((market_value - book) * 100) / 100;
      return {
        user_id: userId,
        account_id: h.account_type === "TFSA" ? byName["Wealthsimple TFSA"] : byName["Wealthsimple FHSA"],
        symbol: h.symbol,
        name: h.name,
        quantity: h.qty,
        average_cost: h.cost,
        current_price: h.price,
        market_value,
        unrealized_gain,
        unrealized_gain_pct: Math.round((unrealized_gain / book) * 10000) / 100,
        account_type: h.account_type,
        asset_type: h.asset_type,
      };
    })
  );

  // ---------- Crypto ----------
  await insert("crypto_holdings", [
    { user_id: userId, symbol: "BTC", name: "Bitcoin", quantity: 0.0185, average_cost_cad: 88400, current_price_cad: 131500, market_value_cad: 2432.75, unrealized_gain_cad: 797.35, unrealized_gain_pct: 48.76 },
    { user_id: userId, symbol: "ETH", name: "Ethereum", quantity: 0.21, average_cost_cad: 3600, current_price_cad: 3415, market_value_cad: 717.15, unrealized_gain_cad: -38.85, unrealized_gain_pct: -5.14 },
  ]);

  // ---------- Budgets ----------
  const monthStart = monthsAgo(0, 1);
  await insert("budgets", [
    { user_id: userId, name: "Groceries", emoji: "🛒", total_amount: 550, spent_amount: 0, period: "monthly", start_date: monthStart, category: "Groceries", color: "#10B981" },
    { user_id: userId, name: "Dining out", emoji: "🍽️", total_amount: 200, spent_amount: 0, period: "monthly", start_date: monthStart, category: "Dining", color: "#F59E0B" },
  ]);

  // ---------- Net worth snapshots (4 months, cards trending down) ----------
  const snapshots = [3, 2, 1, 0].map((m) => {
    const growth = (3 - m) * 900; // investments drift up
    const cardIon = 1450 - (3 - m) * 270;
    const cardPlat = 1900 - (3 - m) * 260;
    const balances: Record<string, number> = {
      [chequing]: 4300 + (3 - m) * 170,
      [savings]: 11000 + (3 - m) * 500,
      [ion]: cardIon,
      [platinum]: cardPlat,
      [byName["Wealthsimple TFSA"]]: 25800 + growth,
      [byName["Wealthsimple FHSA"]]: 8700 + (3 - m) * 300,
      [byName["Coinbase"]]: 2800 + (3 - m) * 115,
    };
    const liabilities = cardIon + cardPlat;
    const assets = Object.entries(balances)
      .filter(([id]) => id !== ion && id !== platinum)
      .reduce((s, [, v]) => s + v, 0);
    return {
      user_id: userId,
      snapshot_date: monthsAgo(m, 28) <= iso(new Date()) ? monthsAgo(m, 28) : iso(new Date()),
      account_balances: balances,
      total_assets: assets,
      total_liabilities: liabilities,
      net_worth: assets - liabilities,
    };
  });
  await insert("net_worth_snapshots", snapshots);

  // ---------- Settings ----------
  {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, avion_points_balance: 42350, dry_powder_amount: 4000, dry_powder_account_id: savings });
    if (error) throw new Error(`user_settings: ${error.message}`);
    console.log("  user_settings: updated");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
