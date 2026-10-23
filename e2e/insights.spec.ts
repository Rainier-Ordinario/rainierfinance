import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/insights");
});

test("money flow accounts for income, spending groups, and savings", async ({ page }) => {
  const flow = page.locator("[data-slot=card]", { hasText: "Where your income goes" });
  await expect(flow).toContainText(/Of \$[\d,]+ income/);
  for (const group of ["Fixed", "Essentials", "Discretionary"]) {
    await expect(flow).toContainText(group);
  }
  await expect(flow).toContainText("Saved");
});

test("rising categories surface creeping delivery spending", async ({ page }) => {
  const trends = page.locator("[data-slot=card]", { hasText: "Category trends" });
  await trends.getByRole("tab", { name: "Rising" }).click();
  await expect(trends.getByRole("link", { name: /^Food Delivery/ })).toBeVisible();
  await expect(trends.getByRole("link", { name: /^Groceries/ })).toHaveCount(0);
});

test("a merchant's history opens from Top merchants", async ({ page }) => {
  const merchants = page.locator("[data-slot=card]", { hasText: "Top merchants" });
  await merchants.getByRole("tab", { name: "Most visits" }).click();
  await merchants.getByRole("button", { name: "See Starbucks history" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Starbucks");
  await expect(sheet).toContainText("Visits");
  await expect(sheet.getByRole("link", { name: "See all transactions" })).toBeVisible();
});
