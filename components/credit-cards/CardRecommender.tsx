"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/lib/hooks/useCategories";
import { ION_PLUS_CATEGORIES, recommendCard } from "@/lib/utils/portfolio";

export function CardRecommender() {
  const categories = useCategories();
  const [selected, setSelected] = useState<string | null>(null);

  const expenseCategories = (categories.data ?? []).filter(
    (c) => c.type !== "income"
  );
  const recommendation = selected ? recommendCard(selected) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Which card should I use?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">RBC ION+</p>
              <Badge>3x points</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ION_PLUS_CATEGORIES.map((c) => (
                <Badge key={c} variant="secondary" className="font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">RBC Avion Platinum</p>
              <Badge variant="outline">1x points</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything else — travel, shopping, bills, one-off purchases.
              Better insurance and travel protections.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
          <Select value={selected ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-44" aria-label="Spending category">
              <SelectValue placeholder="Pick a category…" />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recommendation ? (
            <p className="flex items-center gap-2 text-sm">
              <Lightbulb className="size-4 text-warning" aria-hidden />
              Use{" "}
              <span className="font-medium">
                {recommendation === "ION+" ? "RBC ION+" : "RBC Avion Platinum"}
              </span>
              <Badge variant="secondary">
                {recommendation === "ION+" ? "3x" : "1x"} points
              </Badge>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a category to see which card earns more.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
