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

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatPercentSigned(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
