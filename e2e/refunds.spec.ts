import { expect, test } from "@playwright/test";

test("credits that look like refunds can be converted, interest stays income", async ({ page }) => {
  await page.goto("/transactions");
  const banner = page.getByRole("region", { name: "Possible refunds" });
  await expect(banner).toContainText("2 credits look like refunds");
  await banner.getByRole("button", { name: "Review" }).click();

  await expect(banner).toContainText("OFFER Burger King");
  await expect(banner).toContainText("→ Shopping");
  await expect(banner).not.toContainText("DEPOSIT INTEREST");

  await banner.getByRole("button", { name: "Mark 2 as refunds" }).click();
  await expect(page.getByText("Marked 2 transactions as refunds")).toBeVisible();
  await expect(page.getByText(/credits? looks? like refunds/)).toHaveCount(0);

  await page.getByRole("textbox", { name: "Search transactions" }).fill("amazon");
  const refundRow = page.getByRole("row", { name: /AMAZON\.CA MKTP.*\+\$45\.00/ });
  await expect(refundRow).toContainText("refund");
});
