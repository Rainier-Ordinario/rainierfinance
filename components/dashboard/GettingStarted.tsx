"use client";

import Link from "next/link";
import { ArrowRight, Landmark, LineChart, PiggyBank } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    icon: Landmark,
    title: "Connect your bank",
    description: "Link RBC or another bank and transactions sync automatically.",
    href: "/settings",
  },
  {
    icon: LineChart,
    title: "Import investments",
    description: "Bring in your Wealthsimple holdings or Coinbase history.",
    href: "/investments",
  },
  {
    icon: PiggyBank,
    title: "Set a budget",
    description: "Pick a category and a monthly limit to track your pace.",
    href: "/budgets",
  },
];

/** First-run checklist shown on the dashboard until the user has any data. */
export function GettingStarted() {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Get set up</CardTitle>
        <CardDescription>
          Three steps and your dashboard fills itself in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <step.icon className="size-4 text-muted-foreground" aria-hidden />
                  {step.title}
                  <ArrowRight
                    className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.description}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
