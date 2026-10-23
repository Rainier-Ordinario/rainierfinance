"use client";

import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { Flame, Trash2, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import {
  useChallenges,
  useDeleteChallenge,
  useUpsertChallenge,
} from "@/lib/hooks/useGoals";
import {
  challengeProgress,
  suggestCapChallenges,
  type ChallengeProgress,
} from "@/lib/utils/challenges";
import { formatCADWhole } from "@/lib/utils/currency";
import { toISODate } from "@/lib/utils/dates";
import { categoryKind, NOT_SPENDING } from "@/lib/utils/spending";
import { cn } from "@/lib/utils";
import type { Category, Challenge, ChallengeKind, Transaction } from "@/types";

const STATUS_TEXT: Record<ChallengeProgress["status"], string> = {
  won: "Won",
  lost: "Missed",
  on_track: "On track",
  at_risk: "At risk",
};

const STATUS_CLASS: Record<ChallengeProgress["status"], string> = {
  won: "text-success",
  lost: "text-destructive",
  on_track: "text-success",
  at_risk: "text-warning",
};

function ChallengeRow({
  challenge,
  progress,
  categories,
  onDelete,
}: {
  challenge: Challenge;
  progress: ChallengeProgress;
  categories: Category[];
  onDelete: () => void;
}) {
  const isCap = challenge.kind === "category_cap";
  return (
    <li className="space-y-2 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          {isCap ? (
            <CategoryIcon category={challenge.category ?? ""} categories={categories} />
          ) : (
            <Flame className="size-5 text-chart-1" aria-hidden />
          )}
          {isCap
            ? `${challenge.category} under ${formatCADWhole(progress.target)}`
            : `${progress.target} no-spend days`}
        </span>
        <span className="flex items-center gap-1">
          <span className={cn("text-xs font-medium", STATUS_CLASS[progress.status])}>
            {STATUS_TEXT[progress.status]}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onDelete}
            aria-label="Remove challenge"
          >
            <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
          </Button>
        </span>
      </div>
      <Progress
        value={progress.pct}
        aria-label="Challenge progress"
        className={cn(isCap && progress.status === "lost" && "[&>*]:bg-destructive")}
      />
      <p className="text-xs text-muted-foreground">
        {isCap ? (
          <>
            {formatCADWhole(progress.value)} spent
            {progress.daysLeft > 0 && (
              <>
                {" "}
                · on pace for {formatCADWhole(progress.projected ?? 0)} ·{" "}
                {progress.daysLeft} days left
              </>
            )}
          </>
        ) : (
          <>
            {progress.value} of {progress.target} days
            {(progress.streak ?? 0) > 1 && <> · {progress.streak}-day streak</>}
            {progress.daysLeft > 0 && <> · {progress.daysLeft} days left</>}
          </>
        )}
      </p>
    </li>
  );
}

/**
 * This month's spending challenges: short, concrete targets that are easier
 * to stick to than a budget, plus how last month's went.
 */
export function ChallengesCard({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const challenges = useChallenges();
  const upsert = useUpsertChallenge();
  const remove = useDeleteChallenge();
  const [kind, setKind] = useState<ChallengeKind>("category_cap");
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState("");

  const month = toISODate(startOfMonth(new Date()));
  const all = useMemo(() => challenges.data ?? [], [challenges.data]);
  const current = all.filter((c) => c.month === month);
  const past = all.filter((c) => c.month < month);
  const lastMonth = past.length ? past.reduce((m, c) => (c.month > m ? c.month : m), "") : null;
  const lastMonthResults = lastMonth
    ? past
        .filter((c) => c.month === lastMonth)
        .map((c) => challengeProgress(c, transactions, categories))
    : [];

  const suggestions = useMemo(
    () =>
      suggestCapChallenges(
        transactions,
        categories,
        current.filter((c) => c.kind === "category_cap").map((c) => c.category ?? "")
      ),
    [transactions, categories, current]
  );
  const discretionary = categories.filter(
    (c) =>
      c.type !== "income" &&
      !NOT_SPENDING.has(c.name) &&
      categoryKind(c.name, categories) === "discretionary"
  );

  function start(next: Pick<Challenge, "kind" | "target"> & { category?: string | null }) {
    upsert.mutate(
      { ...next, category: next.category ?? null, month },
      {
        onSuccess: () => {
          setTarget("");
          setCategory("");
        },
      }
    );
  }

  const targetNum = Number(target);
  const canStart =
    targetNum > 0 && (kind === "no_spend_days" ? targetNum <= 31 : category !== "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground" aria-hidden />
          Challenges · {format(parseISO(month), "MMMM")}
        </CardTitle>
        <CardDescription>
          A short, specific target for this month.
          {lastMonthResults.length > 0 && (
            <>
              {" "}
              Last month you won{" "}
              {lastMonthResults.filter((r) => r.status === "won").length} of{" "}
              {lastMonthResults.length}.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {current.map((c) => (
              <ChallengeRow
                key={c.id}
                challenge={c}
                progress={challengeProgress(c, transactions, categories)}
                categories={categories}
                onDelete={() => remove.mutate(c.id)}
              />
            ))}
          </ul>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Try:</span>
            {suggestions.map((s) => (
              <Button
                key={s.category}
                variant="outline"
                size="sm"
                disabled={upsert.isPending}
                onClick={() =>
                  start({ kind: "category_cap", category: s.category, target: s.cap })
                }
              >
                {s.category} under {formatCADWhole(s.cap)}
                <span className="text-muted-foreground">
                  (usually {formatCADWhole(s.usual)})
                </span>
              </Button>
            ))}
            {!current.some((c) => c.kind === "no_spend_days") && (
              <Button
                variant="outline"
                size="sm"
                disabled={upsert.isPending}
                onClick={() => start({ kind: "no_spend_days", target: 10 })}
              >
                10 no-spend days
              </Button>
            )}
          </div>
        )}

        <form
          className="flex flex-wrap items-end gap-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canStart) return;
            start({
              kind,
              category: kind === "category_cap" ? category : null,
              target: targetNum,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Challenge</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ChallengeKind)}>
              <SelectTrigger className="w-44" aria-label="Challenge type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category_cap">Keep a category under</SelectItem>
                <SelectItem value="no_spend_days">No-spend days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "category_cap" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40" aria-label="Category">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {discretionary.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-target" className="text-xs">
              {kind === "category_cap" ? "Cap ($)" : "Days"}
            </Label>
            <Input
              id="challenge-target"
              type="number"
              min={1}
              max={kind === "no_spend_days" ? 31 : undefined}
              className="w-24"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!canStart || upsert.isPending}>
            Start
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
