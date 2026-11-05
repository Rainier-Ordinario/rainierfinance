import { expect, test } from "@playwright/test";
import { format, subMonths } from "date-fns";

// Synthetic data has one "ZZQX CYCLE SHOP <40 + months ago>" charge on the
// 12th of each past month, so each month's row is easy to tell apart.
const lastMonth = subMonths(new Date(), 1);
const twoMonthsAgo = subMonths(new Date(), 2);

test("the month and year pickers filter transactions and step by month", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("textbox", { name: "Search transactions" }).fill("ZZQX");

  await page.getByRole("combobox", { name: "Year" }).click();
  await page.getByRole("option", { name: format(lastMonth, "yyyy"), exact: true }).click();
  await page.getByRole("combobox", { name: "Month" }).click();
  await page.getByRole("option", { name: format(lastMonth, "MMMM") }).click();

  await expect(page.getByText("ZZQX CYCLE SHOP 41")).toBeVisible();
  await expect(page.getByText("ZZQX CYCLE SHOP 42")).toHaveCount(0);

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByRole("combobox", { name: "Month" })).toHaveText(format(twoMonthsAgo, "MMMM"));
  await expect(page.getByText("ZZQX CYCLE SHOP 42")).toBeVisible();
  await expect(page.getByText("ZZQX CYCLE SHOP 41")).toHaveCount(0);

  await page.getByRole("combobox", { name: "Year" }).click();
  await page.getByRole("option", { name: "All dates" }).click();
  await expect(page.getByText("ZZQX CYCLE SHOP 41")).toBeVisible();
  await expect(page.getByText("ZZQX CYCLE SHOP 42")).toBeVisible();
});

test("a transaction can be edited into a transfer, and rows bulk-marked", async ({ page }) => {
  await page.goto("/transactions");
  const search = page.getByRole("textbox", { name: "Search transactions" });

  await search.fill("ZZQX CYCLE SHOP 41");
  await page.getByRole("button", { name: "Edit ZZQX CYCLE SHOP 41" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Transfer" }).click();
  await expect(dialog.getByRole("button", { name: "Sent out of this account" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("combobox", { name: "Category" })).toHaveText(/Transfer/);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("row", { name: /ZZQX CYCLE SHOP 41/ })).toContainText("transfer");

  await search.fill("ZZQX CYCLE SHOP 4");
  await page.getByRole("checkbox", { name: "Select ZZQX CYCLE SHOP 42" }).click();
  await page.getByRole("checkbox", { name: "Select ZZQX CYCLE SHOP 43" }).click();
  await page.getByRole("button", { name: "Mark as transfer" }).click();
  await expect(page.getByText("Marked 2 transactions as transfers")).toBeVisible();
  await expect(page.getByRole("row", { name: /ZZQX CYCLE SHOP 43/ })).toContainText("transfer");

  // Transfers have their own tab, and the money-out sign is kept.
  await page.getByRole("tab", { name: "Transfers" }).click();
  await expect(page.getByRole("row", { name: /ZZQX CYCLE SHOP 42.*-\$90\.00/ })).toBeVisible();
});
