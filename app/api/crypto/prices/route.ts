import { NextRequest, NextResponse } from "next/server";

// Coinbase public APIs — no auth required.
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";
const COINBASE_RATES_URL = "https://api.coinbase.com/v2/exchange-rates";

async function fetchSpot(pair: string): Promise<number | null> {
  try {
    const res = await fetch(`${COINBASE_SPOT_URL}/${pair}/spot`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { amount?: string } };
    const amount = Number(json.data?.amount);
    return Number.isFinite(amount) ? amount : null;
  } catch {
    return null;
  }
}

/** CAD per 1 unit of `currency` (e.g. USD → ~1.37). */
async function fetchCadRate(currency: string): Promise<number | null> {
  try {
    const res = await fetch(`${COINBASE_RATES_URL}?currency=${currency}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { rates?: Record<string, string> };
    };
    const rate = Number(json.data?.rates?.CAD);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols") ?? "";
  const fxParam = request.nextUrl.searchParams.get("fx");
  const symbols = [
    ...new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{1,10}$/.test(s))
    ),
  ];

  if (symbols.length === 0 && !fxParam) {
    return NextResponse.json(
      { error: "Provide ?symbols=BTC,ETH and/or ?fx=USD" },
      { status: 400 }
    );
  }
  if (symbols.length > 25) {
    return NextResponse.json(
      { error: "Too many symbols (max 25)" },
      { status: 400 }
    );
  }

  // Lazily fetch USD→CAD once; used for fx responses and USD-spot fallback.
  let usdCadPromise: Promise<number | null> | null = null;
  const usdCad = () => {
    usdCadPromise = usdCadPromise ?? fetchCadRate("USD");
    return usdCadPromise;
  };

  const entries = await Promise.all(
    symbols.map(async (symbol): Promise<[string, number | null]> => {
      const cad = await fetchSpot(`${symbol}-CAD`);
      if (cad !== null) return [symbol, cad];
      // Smaller tokens often only have a USD pair — convert it.
      const usd = await fetchSpot(`${symbol}-USD`);
      if (usd !== null) {
        const rate = await usdCad();
        if (rate !== null) return [symbol, usd * rate];
      }
      return [symbol, null];
    })
  );

  const body: {
    prices: Record<string, number | null>;
    fx?: number | null;
  } = { prices: Object.fromEntries(entries) };

  if (fxParam?.toUpperCase() === "USD") {
    body.fx = await usdCad();
  }

  return NextResponse.json(body);
}
