import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and the real Supabase project.
 * Global setup creates a throwaway user with synthetic data (never your
 * own account); global teardown deletes it. Needs NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local or the environment.
 *
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Tests share one seeded user; some of them change its data.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    storageState: "e2e/.auth/state.json",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
