import { expect, test } from "@playwright/test";

// The Plaid flow itself needs sandbox keys; without them the app should
// say what's missing instead of failing silently.
test("bank connections explain what's needed before Plaid keys are added", async ({ page }) => {
  test.skip(Boolean(process.env.PLAID_CLIENT_ID), "Plaid keys are set");
  await page.goto("/settings");
  await expect(page.getByText("Bank connections")).toBeVisible();
  await page.getByRole("button", { name: "Connect bank" }).first().click();
  await expect(page.getByText(/Bank sync isn't set up yet/)).toBeVisible();
});

test("transactions offer bank sync, with CSV import kept as a fallback", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /Connect bank|Sync/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import CSV" })).toBeVisible();
});
