import Papa from "papaparse";

/**
 * Neutralize CSV formula injection: a cell starting with = + - @ (or tab/CR)
 * is treated as a formula by Excel/Sheets. Prefix with an apostrophe so it's
 * read as text. https://owasp.org/www-community/attacks/CSV_Injection
 */
function neutralizeFormula(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, unknown>>
) {
  const safeRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, neutralizeFormula(v)])
    )
  );
  const csv = Papa.unparse(safeRows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
