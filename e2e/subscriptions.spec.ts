import { expect, test } from "@playwright/test";

test("subscriptions flag stale charges and outdated amounts", async ({ page }) => {
  await page.goto("/subscriptions");
  const gym = page.locator("[data-slot=card]", { hasText: "GoodLife Fitness" });
  await expect(gym).toContainText("Cancelled?");

  const netflix = page.locator("[data-slot=card]", { hasText: "Netflix" }).first();
  await expect(netflix).toContainText("Last charged $20.99");
  await netflix.getByRole("button", { name: "Update amount" }).click();
  await expect(netflix).toContainText("$20.99/mo");
});
