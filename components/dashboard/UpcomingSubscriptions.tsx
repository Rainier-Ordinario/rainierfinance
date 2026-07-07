"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCAD } from "@/lib/utils/currency";
import { daysUntil } from "@/lib/utils/dates";
import { initialsFor, logoUrlFor } from "@/lib/utils/logos";
import type { Subscription } from "@/types";

export function SubscriptionLogo({
  subscription,
  size = 32,
}: {
  subscription: Pick<Subscription, "name" | "logo_url">;
  size?: number;
}) {
  const url = subscription.logo_url ?? logoUrlFor(subscription.name);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-md"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initialsFor(subscription.name)}
    </span>
  );
}

export function UpcomingSubscriptions({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  const upcoming = subscriptions
    .filter((s) => s.status === "active")
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href="/subscriptions" className="hover:underline">
            Upcoming Subscriptions
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active subscriptions.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((sub) => {
              const days = daysUntil(sub.next_billing_date);
              return (
                <li key={sub.id} className="flex items-center gap-3">
                  <SubscriptionLogo subscription={sub} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.billing_cycle ?? "monthly"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-numeric text-sm font-medium">
                      {formatCAD(Number(sub.amount))}
                    </p>
                    <Badge
                      variant={days <= 3 ? "destructive" : "secondary"}
                      className="mt-0.5"
                    >
                      {days < 0 ? "overdue" : days === 0 ? "today" : `in ${days}d`}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
