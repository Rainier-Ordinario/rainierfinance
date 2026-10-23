import { expect, test } from "@playwright/test";

test("the alerts bell lists what needs attention, most urgent first", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /\d+ alerts/ }).click();
  const items = page.locator("[data-slot=popover-content] li");
  await expect(items.first()).toContainText(/Delivery is \$[\d,]+ over budget/);
  await expect(page.getByText("GoodLife Fitness renews tomorrow")).toBeVisible();

  await page.getByRole("button", { name: /Dismiss: GoodLife Fitness renews tomorrow/ }).click();
  await expect(page.getByText("GoodLife Fitness renews tomorrow")).toHaveCount(0);
});
