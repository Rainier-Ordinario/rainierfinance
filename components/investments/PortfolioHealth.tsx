"use client";

import { CheckCircle2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { assessPortfolioHealth } from "@/lib/utils/portfolio";
import { cn } from "@/lib/utils";
import type { Investment } from "@/types";

const GRADE_COLORS: Record<string, string> = {
  A: "text-success",
  B: "text-warning",
  C: "text-destructive",
};

export function PortfolioHealth({ holdings }: { holdings: Investment[] }) {
  const health = assessPortfolioHealth(holdings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portfolio Health</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-16 shrink-0 items-center justify-center rounded-full border-4 text-3xl font-bold",
            GRADE_COLORS[health.grade]
          )}
          style={{ borderColor: "currentColor" }}
          aria-label={`Portfolio grade ${health.grade}`}
        >
          {health.grade}
        </div>
        <ul className="space-y-2 text-sm">
          {health.feedback.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              {health.grade === "A" ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <Info
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
