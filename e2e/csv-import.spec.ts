import { expect, test } from "@playwright/test";

// Dated outside the transactions page's 24-month window so these rows don't
// shift the numbers other tests assert on.
const ALL_ACCOUNTS_EXPORT = [
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$",
  'Visa,XXXX4321,3/4/2024,,STARBUCKS #1234,,"-6.50",',
  'Visa,XXXX4321,3/5/2024,,PAYMENT - THANK YOU,,"200.00",',
  'Chequing,XXXX8765,3/1/2024,,PAYROLL DEPOSIT,ACME CORP,"2,000.00",',
  'Chequing,XXXX8765,3/2/2024,,SAVE-ON-FOODS #911,,"-80.25",',
  'Chequing,XXXX8765,3/5/2024,,PAYMENT TO RBC VISA,,"-200.00",',
].join("\n");

const file = {
  name: "rbc-all-accounts.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(ALL_ACCOUNTS_EXPORT),
};

test("an all-accounts RBC export splits by account and imports in one go", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(file);

  await expect(dialog).toContainText("5 transactions across 2 accounts");
  await expect(dialog.getByRole("textbox", { name: "Name for new account ····4321" })).toHaveValue("RBC Visa");
  await expect(dialog.getByText("New credit card account")).toBeVisible();
  await expect(dialog.getByText("New chequing account")).toBeVisible();

  await dialog.getByRole("button", { name: "Import 5" }).click();
  await expect(page.getByText("Imported 5 transactions")).toBeVisible();

  // The same file again: accounts are now matched, and nothing is doubled.
  await page.getByRole("button", { name: "Import CSV" }).click();
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await expect(dialog.getByText("RBC Visa", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/New .* account/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Import 5" }).click();
  await expect(page.getByText(/Nothing new to import/)).toBeVisible();
});

test("the import alert opens the importer", async ({ page }) => {
  await page.goto("/transactions?import=1");
  await expect(page.getByRole("dialog", { name: "Import CSV" })).toBeVisible();
});
