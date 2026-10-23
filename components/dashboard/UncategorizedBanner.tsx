"use client";

import Link from "next/link";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCADWhole } from "@/lib/utils/currency";
import { UNCATEGORIZED, type UncategorizedSummary } from "@/lib/utils/spending";

/** Below this share, uncategorized spend doesn't distort the charts much. */
const MIN_SHARE = 3;

/**
 * Nudge to sort "Other" spending: every chart is only as honest as its
 * categories, and fixing one transaction now fixes its whole merchant.
 */
export function UncategorizedBanner({
  summary,
}: {
  summary: UncategorizedSummary;
}) {
  if (summary.count === 0 || summary.share < MIN_SHARE) return null;

  const params = new URLSearchParams({
    type: "expense",
    category: UNCATEGORIZED,
    from: summary.start,
    to: summary.end,
  });

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center">
      <Tags className="hidden size-5 shrink-0 text-warning sm:block" aria-hidden />
      <p className="flex-1 text-sm">
        <span className="font-medium">
          {formatCADWhole(summary.amount)} ({Math.round(summary.share)}%) of
          your spending
        </span>{" "}
        over the last 90 days isn&apos;t categorized, across {summary.count}{" "}
        {summary.count === 1 ? "transaction" : "transactions"}. Sorting one
        sorts every charge from that merchant.
      </p>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href={`/transactions?${params}`}>Review</Link>
      </Button>
    </div>
  );
}
