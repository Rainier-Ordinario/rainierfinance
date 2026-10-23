const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const cadWholeFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function formatCAD(amount: number): string {
  return cadFormatter.format(amount);
}

export function formatCADWhole(amount: number): string {
  return cadWholeFormatter.format(amount);
}

/** "+$123.45" / "-$123.45" — for gains/losses where the sign matters. */
export function formatCADSigned(amount: number): string {
  const formatted = cadFormatter.format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

/**
 * Display form of a transaction amount. Income is always "+". Expenses are
 * stored negative, so a positive expense is a refund and also shows "+".
 */
export function formatTransactionAmount(
  amount: number,
  type: "income" | "expense" | "transfer"
): string {
  const abs = cadFormatter.format(Math.abs(amount));
  if (type === "income") return `+${abs}`;
  if (type === "expense") return amount > 0 ? `+${abs}` : `-${abs}`;
  return abs;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatPercentSigned(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
