/**
 * Clear script: deletes all finance data for one user so real data (e.g. an
 * RBC CSV export) can be imported into a clean slate. Keeps the login, the
 * profile, default categories, and the user_settings row (preference values
 * are reset to zero). Runs with the service-role key (bypasses RLS).
 *
 * Usage:
 *   npm run clear-data -- --email you@example.com
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
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emailArg = process.argv.indexOf("--email");
const targetEmail = emailArg !== -1 ? process.argv[emailArg + 1] : null;
if (!targetEmail) {
  console.error("Usage: npm run clear-data -- --email you@example.com");
  process.exit(1);
}

// Children first; accounts last (other tables reference accounts).
const TABLES = [
  "transactions",
  "payment_reminders",
  "subscriptions",
  "investments",
  "crypto_holdings",
  "budgets",
  "net_worth_snapshots",
  "chat_messages",
  "accounts",
] as const;

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  const user = data.users.find(
    (u) => u.email?.toLowerCase() === targetEmail!.toLowerCase()
  );
  if (!user) {
    console.error(`No user with email ${targetEmail} found.`);
    process.exit(1);
  }

  console.log(`Clearing all finance data for ${targetEmail} (${user.id})`);

  const { error: settingsError } = await supabase
    .from("user_settings")
    .update({
      avion_points_balance: 0,
      dry_powder_amount: 0,
      dry_powder_account_id: null,
    })
    .eq("user_id", user.id);
  if (settingsError) throw settingsError;
  console.log("  user_settings: preferences reset");

  for (const table of TABLES) {
    const { error: delError, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", user.id);
    if (delError) throw new Error(`${table}: ${delError.message}`);
    console.log(`  ${table}: ${count} rows deleted`);
  }

  console.log(
    "Done. Add your real accounts in the app, then import your RBC CSV from the Transactions page."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
