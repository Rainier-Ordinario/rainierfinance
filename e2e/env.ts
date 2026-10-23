import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Load .env.local into process.env (CI provides real env vars instead). */
export function loadEnv() {
  const file = resolve(".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export const E2E_EMAIL = "e2e-test@rainierfinance.test";
export const AUTH_DIR = "e2e/.auth";

export function adminClient() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "E2E tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Delete the throwaway user if it exists (its rows cascade). */
export async function deleteTestUser() {
  const sb = adminClient();
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === E2E_EMAIL);
  if (user) await sb.auth.admin.deleteUser(user.id);
}
