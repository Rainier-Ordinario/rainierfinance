import type { Investment, UtilizationResult } from "@/types";

/**
 * Canonical credit utilization tiers, used everywhere utilization is shown:
 * ≤10% excellent (green), ≤30% good (amber), ≤50% warning (orange),
 * above that danger (red).
 */
export function calculateUtilization(
  balance: number,
  limit: number
): UtilizationResult {
  const pct = limit > 0 ? (balance / limit) * 100 : 0;
  if (pct <= 10) return { percentage: pct, status: "excellent", color: "#10B981" };
  if (pct <= 30) return { percentage: pct, status: "good", color: "#F59E0B" };
  if (pct <= 50) return { percentage: pct, status: "warning", color: "#F97316" };
  return { percentage: pct, status: "danger", color: "#EF4444" };
}

export const ION_PLUS_CATEGORIES = [
  "Groceries",
  "Gas",
  "Dining",
  "Food Delivery",
  "Rideshare",
  "Streaming",
  "Digital Gaming",
  "Transit",
];

export function recommendCard(category: string): "ION+" | "Platinum" {
  return ION_PLUS_CATEGORIES.includes(category) ? "ION+" : "Platinum";
}

/** Avion: ION+ earns 3x on bonus categories, both cards earn 1x elsewhere. */
export function estimateAvionPoints(amount: number, category: string): number {
  const multiplier = recommendCard(category) === "ION+" ? 3 : 1;
  return Math.round(amount * multiplier);
}

// ---------- Portfolio health ----------

export interface PortfolioHealth {
  grade: "A" | "B" | "C";
  score: number; // 0-100
  feedback: string[];
}

/** Rough geographic buckets for common Canadian-listed holdings. */
const GEOGRAPHY: Record<string, "US" | "Canada" | "International" | "Global"> = {
  VFV: "US",
  QQC: "US",
  AMD: "US",
  NVDA: "US",
  MSFT: "US",
  META: "US",
  MU: "US",
  GOOG: "US",
  AMZN: "US",
  SMCI: "US",
  XEQT: "Global",
  ZEA: "International",
  RY: "Canada",
  CNR: "Canada",
  POW: "Canada",
};

export function geographicBreakdown(holdings: Investment[]) {
  const buckets: Record<string, number> = {
    US: 0,
    Canada: 0,
    International: 0,
  };
  for (const h of holdings) {
    const value = h.market_value ?? 0;
    const geo = GEOGRAPHY[h.symbol] ?? "US";
    if (geo === "Global") {
      // XEQT-style all-world funds: rough split
      buckets.US += value * 0.45;
      buckets.Canada += value * 0.25;
      buckets.International += value * 0.3;
    } else {
      buckets[geo] += value;
    }
  }
  return buckets;
}

/** Known S&P 500 overlap between common holdings. */
const SP500_OVERLAP = new Set(["VFV", "XEQT", "QQC"]);

export function assessPortfolioHealth(holdings: Investment[]): PortfolioHealth {
  const feedback: string[] = [];
  if (holdings.length === 0) {
    return { grade: "C", score: 0, feedback: ["No holdings to assess yet."] };
  }

  const total = holdings.reduce((sum, h) => sum + (h.market_value ?? 0), 0);
  let score = 100;

  // Concentration: any single non-ETF position over 10%
  const concentrated = holdings.filter(
    (h) =>
      h.asset_type === "EQUITY" && total > 0 && (h.market_value ?? 0) / total > 0.1
  );
  if (concentrated.length > 0) {
    score -= 15 * concentrated.length;
    feedback.push(
      `Concentrated single-stock positions: ${concentrated
        .map((h) => h.symbol)
        .join(", ")} each exceed 10% of the portfolio.`
    );
  }

  // ETF overlap: multiple S&P-500-heavy funds
  const overlapping = holdings.filter((h) => SP500_OVERLAP.has(h.symbol));
  if (overlapping.length >= 2) {
    score -= 10;
    feedback.push(
      `${overlapping.map((h) => h.symbol).join(" + ")} overlap heavily on US large caps — you may hold the same companies several times.`
    );
  }

  // Geographic spread
  const geo = geographicBreakdown(holdings);
  const usShare = total > 0 ? geo.US / total : 0;
  if (usShare > 0.75) {
    score -= 10;
    feedback.push(
      `US exposure is ~${Math.round(usShare * 100)}% — consider more Canadian or international diversification.`
    );
  }

  if (feedback.length === 0) {
    feedback.push("Well diversified across funds and geographies. Keep it up.");
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 80 ? "A" : score >= 60 ? "B" : "C";
  return { grade, score, feedback: feedback.slice(0, 3) };
}
