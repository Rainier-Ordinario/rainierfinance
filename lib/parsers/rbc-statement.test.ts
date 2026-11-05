import { describe, expect, it } from "vitest";
import { linesFromItems, type PdfLine } from "@/lib/parsers/pdfText";
import { parseRbcStatement } from "@/lib/parsers/rbc-statement";

// Made-up statements in RBC's layouts. Each row is [x, text] pieces at one
// height; amounts are placed by their right edge like the real PDFs.

type Piece = [x: number, text: string];

function page(rows: Piece[][], pageNo = 1): PdfLine[] {
  const items = rows.flatMap((row, i) =>
    row.map(([x, str]) => ({ str, transform: [1, 0, 0, 1, x, 800 - i * 14], width: str.length * 5 }))
  );
  return linesFromItems(pageNo, items);
}

/** A right-aligned number ending at `right`. */
const at = (right: number, text: string): Piece => [right - text.length * 5, text];

describe("parseRbcStatement — credit card", () => {
  const card = page([
    [[40, "RBC® Avion® Visa Platinum‡"]],
    [[40, "JANE DOE 4500 12** **** 9876"]],
    [[40, "STATEMENT FROM DEC 05, 2025 TO JAN 04, 2026"]],
    [[40, "PREVIOUS ACCOUNT BALANCE"], [300, "$100.00"], [400, "IMPORTANT INFORMATION"]],
    [[40, "DEC 20 DEC 21 JOES PIZZA VANCOUVER BC"], [300, "$25.50"], [400, "CONTACT US"]],
    [[40, "74500000000000000000001"]],
    [[40, "DEC 28 DEC 29 PAYMENT - THANK YOU / PAIEMENT - MERCI"], [300, "-$100.00"]],
    [[40, "JAN 02 JAN 03 CORNER MARKET VANCOUVER BC"], [300, "$10.25"]],
    [[40, "JAN 02 JAN 03 CORNER MARKET VANCOUVER BC"], [300, "$10.25"]],
    [[40, "NEW BALANCE"], [300, "$46.00"]],
  ]);

  it("reads every row, dated in the right year, with the side panel ignored", () => {
    const r = parseRbcStatement(card)!;
    expect(r.account).toEqual({ last4: "9876", accountType: "Visa" });
    expect(r.transactions.map((t) => [t.date, t.description, t.amount])).toEqual([
      ["2025-12-20", "JOES PIZZA VANCOUVER BC", -25.5],
      ["2025-12-28", "PAYMENT - THANK YOU / PAIEMENT - MERCI", 100],
      ["2026-01-02", "CORNER MARKET VANCOUVER BC", -10.25],
      ["2026-01-02", "CORNER MARKET VANCOUVER BC", -10.25],
    ]);
    expect(r.balanced).toBe(true);
  });

  it("types card payments as transfers", () => {
    const payment = parseRbcStatement(card)!.transactions[1];
    expect(payment).toMatchObject({ type: "transfer", category: "Transfer" });
  });

  it("flags a statement whose rows don't add up", () => {
    const missingRow = card.filter((l) => !l.text.startsWith("DEC 20"));
    expect(parseRbcStatement(missingRow)!.balanced).toBe(false);
  });
});

describe("parseRbcStatement — chequing", () => {
  const W = 330, D = 430, B = 520;
  const chequing = page([
    [[40, "Your RBC personal banking account statement"]],
    [[300, "From December 18, 2025 to January 16, 2026"]],
    [[300, "Your account number:"], [450, "01234-5556789"]],
    [[40, "RBC Advantage Banking 01234-5556789"]],
    [[40, "Date"], [80, "Description"], at(W, "Withdrawals ($)"), at(D, "Deposits ($)"), at(B, "Balance ($)")],
    [[80, "Opening Balance"], at(B, "50.00")],
    [[40, "20 Dec"], [80, "e-Transfer received JANE DOE"]],
    [[90, "CA1234AB"], at(D, "1,000.00"), at(B, "1,050.00")],
    [[80, "Online Transfer to Deposit Account-1111"], at(W, "500.00"), at(B, "550.00")],
    [[40, "3 Jan"], [80, "Contactless Interac purchase - 1234 CORNER MARKET"], at(W, "12.34"), at(B, "537.66")],
    [[80, "Closing Balance"], at(B, "$537.66")],
  ]);

  it("splits withdrawals from deposits by column and joins wrapped rows", () => {
    const r = parseRbcStatement(chequing)!;
    expect(r.account).toEqual({ last4: "6789", accountType: "Chequing" });
    expect(r.transactions.map((t) => [t.date, t.description, t.amount, t.type])).toEqual([
      ["2025-12-20", "e-Transfer received JANE DOE CA1234AB", 1000, "income"],
      ["2025-12-20", "Online Transfer to Deposit Account-1111", -500, "transfer"],
      ["2026-01-03", "Contactless Interac purchase - 1234 CORNER MARKET", -12.34, "expense"],
    ]);
    expect(r.balanced).toBe(true);
  });

  it("recognizes a savings account from its product name", () => {
    const savings = chequing.map((l) =>
      l.text.startsWith("RBC Advantage Banking")
        ? { ...l, text: "RBC High Interest eSavings 01234-5556789" }
        : l
    );
    expect(parseRbcStatement(savings)!.account.accountType).toBe("Savings");
  });
});

it("returns null for a PDF that isn't an RBC statement", () => {
  expect(parseRbcStatement(page([[[40, "Hello world"]]]))).toBeNull();
});
