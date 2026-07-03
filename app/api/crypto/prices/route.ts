import { NextRequest, NextResponse } from "next/server";

// Coinbase public spot-price API — no auth required.
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{1,10}$/.test(s))
    ),
  ];

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "Provide ?symbols=BTC,ETH" },
      { status: 400 }
    );
  }
  if (symbols.length > 25) {
    return NextResponse.json(
      { error: "Too many symbols (max 25)" },
      { status: 400 }
    );
  }

  const entries = await Promise.all(
    symbols.map(async (symbol): Promise<[string, number | null]> => {
      try {
        const res = await fetch(`${COINBASE_SPOT_URL}/${symbol}-CAD/spot`, {
          next: { revalidate: 60 },
        });
        if (!res.ok) return [symbol, null];
        const json = (await res.json()) as { data?: { amount?: string } };
        const amount = Number(json.data?.amount);
        return [symbol, Number.isFinite(amount) ? amount : null];
      } catch {
        return [symbol, null];
      }
    })
  );

  return NextResponse.json({ prices: Object.fromEntries(entries) });
}
