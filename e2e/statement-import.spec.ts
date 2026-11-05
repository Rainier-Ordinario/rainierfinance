import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

// A made-up RBC chequing statement built as a real PDF, so the browser's
// PDF reading is exercised end to end. Dated outside the transactions
// page's 24-month window so it doesn't shift other tests' numbers.
async function statementPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 740;
  const text = (x: number, s: string) => page.drawText(s, { x, y, size: 9, font });
  const right = (edge: number, s: string) => text(edge - font.widthOfTextAtSize(s, 9), s);
  const row = (draw: () => void) => {
    draw();
    y -= 14;
  };
  const W = 360, D = 450, B = 560;

  row(() => text(40, "Your RBC personal banking account statement"));
  row(() => text(300, "From January 18, 2024 to February 16, 2024"));
  row(() => {
    text(300, "Your account number:");
    text(420, "01234-5558642");
  });
  row(() => text(40, "RBC Advantage Banking 01234-5558642"));
  row(() => {
    text(40, "Date");
    text(80, "Description");
    right(W, "Withdrawals ($)");
    right(D, "Deposits ($)");
    right(B, "Balance ($)");
  });
  row(() => {
    text(80, "Opening Balance");
    right(B, "100.00");
  });
  row(() => {
    text(40, "22 Jan");
    text(80, "Payroll Deposit EXAMPLE CORP");
    right(D, "1,500.00");
    right(B, "1,600.00");
  });
  row(() => {
    text(40, "25 Jan");
    text(80, "Contactless Interac purchase - 1234 CORNER MARKET");
    right(W, "42.10");
    right(B, "1,557.90");
  });
  row(() => {
    text(80, "Closing Balance");
    right(B, "$1,557.90");
  });
  return Buffer.from(await doc.save());
}

test("an RBC PDF statement imports into its account", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "Chequing Statement-8642 2024-02-16.pdf",
    mimeType: "application/pdf",
    buffer: await statementPdf(),
  });

  await expect(dialog).toContainText("2 transactions across 1 account");
  await expect(dialog.getByRole("textbox", { name: "Name for new account ····8642" })).toHaveValue(
    "RBC Chequing"
  );
  await expect(dialog).not.toContainText("to check");
  await expect(dialog.getByText("CORNER MARKET")).toBeVisible();

  await dialog.getByRole("button", { name: "Import 2" }).click();
  await expect(page.getByText("Imported 2 transactions")).toBeVisible();
});
