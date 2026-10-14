import { describe, expect, it } from "vitest";
import { detectSubscriptionCandidates } from "@/lib/utils/detectSubscriptions";
import type { ParsedCsvTransaction } from "@/types";

function row(partial: Partial<ParsedCsvTransaction>): ParsedCsvTransaction {
  return {
    date: "2026-07-01",
    description: "SPOTIFY *123",
    amount: -9.99,
    category: "Streaming",
    type: "expense",
    ...partial,
  };
}

describe("detectSubscriptionCandidates", () => {
  it("flags the same merchant + amount appearing twice", () => {
    const [candidate] = detectSubscriptionCandidates([
      row({ date: "2026-06-01" }),
      row({ date: "2026-07-01" }),
    ]);
    expect(candidate).toMatchObject({
      name: "Spotify",
      amount: 9.99,
      occurrences: 2,
      lastDate: "2026-07-01",
    });
  });

  it("ignores single occurrences and differing amounts", () => {
    expect(
      detectSubscriptionCandidates([
        row({ amount: -9.99 }),
        row({ amount: -12.99, date: "2026-07-15" }),
      ])
    ).toHaveLength(0);
  });

  it("ignores income/positive amounts", () => {
    expect(
      detectSubscriptionCandidates([
        row({ amount: 9.99 }),
        row({ amount: 9.99, date: "2026-07-15" }),
      ])
    ).toHaveLength(0);
  });

  it("keeps one candidate per merchant (strongest signal)", () => {
    const candidates = detectSubscriptionCandidates([
      row({ amount: -9.99, date: "2026-05-01" }),
      row({ amount: -9.99, date: "2026-06-01" }),
      row({ amount: -9.99, date: "2026-07-01" }),
      row({ amount: -4.5, date: "2026-06-10" }),
      row({ amount: -4.5, date: "2026-07-10" }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].occurrences).toBe(3);
  });
});
