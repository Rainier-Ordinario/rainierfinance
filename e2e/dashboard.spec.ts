import { expect, test } from "@playwright/test";

test("dashboard shows the daily number and where spending goes", async ({ page }) => {
  await page.goto("/dashboard");
  const safe = page.locator("[data-slot=card]", { hasText: "Safe to spend today" });
  await expect(safe).toContainText(/\$[\d,]+/);
  await expect(safe).toContainText("left for wants");

  const mix = page.locator("[data-slot=card]", { hasText: "Where it goes" });
  for (const group of ["Fixed", "Essentials", "Discretionary"]) {
    await expect(mix).toContainText(group);
  }
});

test("clicking a donut category opens its transactions for that period", async ({ page }) => {
  await page.goto("/dashboard");
  const donut = page.locator("[data-slot=card]", { hasText: "Spending by Category" });
  await donut.getByRole("combobox", { name: "Period" }).click();
  await page.getByRole("option", { name: "Last month" }).click();
  await donut.getByRole("button", { name: "See Groceries transactions" }).click();

  await expect(page).toHaveURL(/\/transactions\?.*category=Groceries/);
  await expect(page.getByRole("checkbox", { name: /Groceries/ })).toBeChecked();
  await expect(page.getByRole("row", { name: /SAVE-ON-FOODS/ }).first()).toBeVisible();
});
