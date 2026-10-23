import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { chromium, type FullConfig } from "@playwright/test";
import { AUTH_DIR, E2E_EMAIL, adminClient, deleteTestUser } from "./env";
import { syntheticData } from "./fixtures";

/**
 * Create a fresh throwaway user, fill it with synthetic data, and save a
 * signed-in browser session for the tests to reuse.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const sb = adminClient();
  await deleteTestUser();

  const password = randomBytes(18).toString("base64url");
  const { data: created, error } = await sb.auth.admin.createUser({
    email: E2E_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Test" },
  });
  if (error) throw error;
  const uid = created.user.id;

  const { data: account, error: accountError } = await sb
    .from("accounts")
    .insert({
      user_id: uid,
      name: "Test Chequing",
      type: "chequing",
      institution: "RBC",
      balance: 3000,
      color: "#005DAA",
    })
    .select()
    .single();
  if (accountError) throw accountError;

  const data = syntheticData(uid, account.id, new Date());
  for (const [table, rows] of Object.entries(data)) {
    const { error: insertError } = await sb.from(table).insert(rows);
    if (insertError) throw new Error(`${table}: ${insertError.message}`);
  }

  mkdirSync(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.fill('input[type="email"]', E2E_EMAIL);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  await page.context().storageState({ path: `${AUTH_DIR}/state.json` });
  await browser.close();
}
