import { rbcTransaction, type RbcDetectedAccount } from "@/lib/parsers/rbc-csv";
import type { PdfLine } from "@/lib/parsers/pdfText";
import type { ParsedCsvTransaction } from "@/types";

// RBC PDF statements: credit card ("RBC ... Visa") and personal banking
// (chequing/savings). Both are text PDFs; the parser reads their lines.

export interface RbcStatementResult {
  account: RbcDetectedAccount;
  transactions: ParsedCsvTransaction[];
  errors: string[];
  /** Opening + every row = closing, to the cent. False means rows were missed. */
  balanced: boolean;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

const MONEY = /^-?\$?-?[\d,]+\.\d{2}$/;

function money(raw: string): number {
  const negative = raw.includes("-");
  const value = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return negative ? -value : value;
}

const cents = (x: number) => Math.round(x * 100);

/**
 * ISO date for a statement row's day and month. Rows in a statement that
 * ends in January but started in December belong to the year before.
 */
function rowDate(day: number, month: number, end: { year: number; month: number }): string {
  const year = month > end.month ? end.year - 1 : end.year;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ---------- Credit card ----------

const VISA_PERIOD =
  /STATEMENT FROM [A-Z]{3} \d{1,2}(?:, \d{4})? TO ([A-Z]{3}) \d{1,2}, (\d{4})/i;
const VISA_CARD = /\d{4} \d{2}\*\* \*{4} (\d{4})/;
// Ends at the amount: the statement's side panel can share a row's line.
const VISA_ROW = /^([A-Z]{3}) (\d{1,2}) [A-Z]{3} \d{1,2} (.+?) (-?\$[\d,]+\.\d{2})(?=\s|$)/;

function parseCardStatement(lines: PdfLine[], all: string): RbcStatementResult | null {
  const period = all.match(VISA_PERIOD);
  const card = all.match(VISA_CARD);
  if (!period || !card) return null;
  const end = { year: Number(period[2]), month: monthIndex(period[1]) };
  const last4 = card[1];
  const product = all.match(/RBC[^\n]*?(Visa|Mastercard)/i)?.[1] ?? "Visa";

  const transactions: ParsedCsvTransaction[] = [];
  for (const line of lines) {
    const m = line.text.match(VISA_ROW);
    if (!m) continue;
    // The card number repeats in headers; a row starts with a date.
    const month = monthIndex(m[1]);
    if (month < 0) continue;
    // Purchases are positive on a card statement; the app stores them negative.
    const amount = -money(m[4]);
    transactions.push(
      rbcTransaction(rowDate(Number(m[2]), month, end), m[3].trim(), amount, last4)
    );
  }

  const previous = all.match(/PREVIOUS (?:ACCOUNT |STATEMENT )?BALANCE \$?(-?[\d,]+\.\d{2})/i);
  const next =
    all.match(/NEW BALANCE \$?(-?[\d,]+\.\d{2})/i) ??
    all.match(/TOTAL ACCOUNT BALANCE \$?(-?[\d,]+\.\d{2})/i);
  // Owed goes up with purchases: previous - (app amounts) = new.
  const balanced =
    previous !== null &&
    next !== null &&
    cents(money(previous[1])) - transactions.reduce((s, t) => s + cents(t.amount), 0) ===
      cents(money(next[1]));

  return {
    account: { last4, accountType: product },
    transactions,
    errors: [],
    balanced,
  };
}

// ---------- Personal banking (chequing / savings) ----------

const BANK_PERIOD = /From [A-Za-z]+ \d{1,2}, \d{4} to ([A-Za-z]+) \d{1,2}, (\d{4})/;
const BANK_ACCOUNT = /Your account number:?\s*([\d-]+)/i;
const BANK_ROW_DATE = /^(\d{1,2}) ([A-Za-z]{3})\b\s*/;

interface Columns {
  withdrawals: number;
  deposits: number;
  balance: number;
}

function headerColumns(line: PdfLine): Columns | null {
  const right = (word: string) => line.items.find((i) => i.str.startsWith(word))?.xEnd;
  const withdrawals = right("Withdrawals");
  const deposits = right("Deposits");
  const balance = right("Balance");
  if (withdrawals === undefined || deposits === undefined || balance === undefined) return null;
  return { withdrawals, deposits, balance };
}

/** Which column a right-aligned number sits in. */
function columnOf(xEnd: number, cols: Columns): keyof Columns {
  const entries = Object.entries(cols) as [keyof Columns, number][];
  return entries.reduce((best, e) =>
    Math.abs(e[1] - xEnd) < Math.abs(best[1] - xEnd) ? e : best
  )[0];
}

function parseBankStatement(lines: PdfLine[], all: string): RbcStatementResult | null {
  const period = all.match(BANK_PERIOD);
  const number = all.match(BANK_ACCOUNT);
  if (!period || !number) return null;
  const end = { year: Number(period[2]), month: monthIndex(period[1]) };
  const digits = number[1].replace(/\D/g, "");
  const last4 = digits.slice(-4);
  // "RBC Advantage Banking 06640-1234567" names the product.
  const productLine = lines.find(
    (l) => l.text.includes(number[1]) && !/account number/i.test(l.text)
  );
  const accountType = /sav/i.test(productLine?.text ?? "") ? "Savings" : "Chequing";

  const errors: string[] = [];
  const transactions: ParsedCsvTransaction[] = [];
  let cols: Columns | null = null;
  let page = 0;
  let day: { day: number; month: number } | null = null;
  let opening: number | null = null;
  let closing: number | null = null;
  // Text of a wrapped row's first line(s): the amounts sit on its last line.
  let pending = "";

  for (const line of lines) {
    if (line.page !== page) {
      page = line.page;
      cols = null;
      pending = "";
    }
    const header = headerColumns(line);
    if (header && /Description/.test(line.text)) {
      cols = header;
      continue;
    }
    if (!cols) continue;

    const amounts = line.items.filter((i) => MONEY.test(i.str));
    const words = line.items.filter((i) => !MONEY.test(i.str)).map((i) => i.str).join(" ");

    if (/^Opening Balance/i.test(words)) {
      if (opening === null && amounts.length) opening = money(amounts[amounts.length - 1].str);
      continue;
    }
    if (/^Closing Balance/i.test(words)) {
      if (amounts.length) closing = money(amounts[amounts.length - 1].str);
      cols = null;
      continue;
    }

    let description = words;
    const date = description.match(BANK_ROW_DATE);
    if (date && monthIndex(date[2]) >= 0) {
      day = { day: Number(date[1]), month: monthIndex(date[2]) };
      description = description.slice(date[0].length);
    }

    let amount: number | null = null;
    for (const a of amounts) {
      const col = columnOf(a.xEnd, cols);
      if (col === "withdrawals") amount = -money(a.str);
      else if (col === "deposits") amount = money(a.str);
    }

    if (amount === null) {
      // A long description wraps; its amounts come on the row's last line.
      if (amounts.length === 0 && description) pending = `${pending} ${description}`.trim();
      continue;
    }
    if (!day) {
      errors.push(`A row before any date: "${line.text}"`);
      continue;
    }
    const full = `${pending} ${description}`.trim();
    pending = "";
    transactions.push(rbcTransaction(rowDate(day.day, day.month, end), full, amount, last4));
  }

  const balanced =
    opening !== null &&
    closing !== null &&
    cents(opening) + transactions.reduce((s, t) => s + cents(t.amount), 0) === cents(closing);

  return { account: { last4, accountType }, transactions, errors, balanced };
}

/** Parse an RBC statement's lines, or null when it isn't one this knows. */
export function parseRbcStatement(lines: PdfLine[]): RbcStatementResult | null {
  const all = lines.map((l) => l.text).join("\n");
  if (VISA_PERIOD.test(all)) return parseCardStatement(lines, all);
  if (BANK_PERIOD.test(all)) return parseBankStatement(lines, all);
  return null;
}
