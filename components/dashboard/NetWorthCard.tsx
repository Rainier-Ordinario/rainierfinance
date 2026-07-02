"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCAD, formatPercentSigned } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

function useAnimatedNumber(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = value; // animate from wherever we currently are
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

export function NetWorthCard({
  netWorth,
  lastMonthNetWorth,
}: {
  netWorth: number;
  lastMonthNetWorth: number | null;
}) {
  const animated = useAnimatedNumber(netWorth);
  const positive = netWorth >= 0;

  const change =
    lastMonthNetWorth !== null ? netWorth - lastMonthNetWorth : null;
  const changePct =
    change !== null && lastMonthNetWorth
      ? (change / Math.abs(lastMonthNetWorth)) * 100
      : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
        <p
          className={cn(
            "text-numeric mt-1 text-3xl font-semibold",
            positive ? "glow-positive text-success" : "glow-negative text-destructive"
          )}
          aria-label={`Net worth ${formatCAD(netWorth)}`}
        >
          {formatCAD(animated)}
        </p>
        {change !== null && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {change >= 0 ? (
              <TrendingUp className="size-3.5 text-success" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5 text-destructive" aria-hidden />
            )}
            <span
              className={cn(
                "text-numeric font-medium",
                change >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatCAD(Math.abs(change))}
              {changePct !== null && ` (${formatPercentSigned(changePct)})`}
            </span>
            vs last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}
