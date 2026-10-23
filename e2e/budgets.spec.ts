import { expect, test } from "@playwright/test";

test("suggested budgets come from spending history and add in one click", async ({ page }) => {
  await page.goto("/budgets");
  const suggestions = page.locator("[data-slot=card]", { hasText: "Suggested budgets" });
  await expect(suggestions).toContainText("Groceries");
  await expect(suggestions).not.toContainText("Other");

  await suggestions
    .getByRole("button", { name: /^Add a \$[\d,]+ monthly budget for Groceries$/ })
    .click();
  await expect(page.getByText("Budget saved")).toBeVisible();
  await expect(page.getByText("Monthly · Groceries")).toBeVisible();
  await expect(suggestions).not.toContainText("Groceries");
});

test("the budget form prices a budget from your usual spend", async ({ page }) => {
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Add budget" }).first().click();
  await page.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Dining" }).click();
  await expect(page.getByRole("dialog")).toContainText("You usually spend");
  await expect(page.locator("#budget-name")).toHaveValue("Dining");
  await page.getByRole("button", { name: /Trim ~10%/ }).click();
  await expect(page.locator("#budget-amount")).not.toHaveValue("");
});
