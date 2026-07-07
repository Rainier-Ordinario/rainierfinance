"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCAD } from "@/lib/utils/currency";
import { daysUntil, formatDateShort } from "@/lib/utils/dates";
import { subscriptionLogoUrl } from "@/lib/utils/subscriptions";
import { cn } from "@/lib/utils";
import type { Account, Subscription } from "@/types";

const CYCLE_LABEL: Record<string, string> = {
  monthly: "/mo",
  yearly: "/yr",
  weekly: "/wk",
};

const STATUS_STYLE: Record<string, string> = {
  active: "text-success",
  paused: "text-warning",
  cancelled: "text-muted-foreground",
};

export function SubscriptionCard({
  subscription,
  accounts,
  onEdit,
  onDelete,
}: {
  subscription: Subscription;
  accounts: Account[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const days = daysUntil(subscription.next_billing_date);
  const account = accounts.find((a) => a.id === subscription.account_id);
  const active = subscription.status === "active";

  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        {logoFailed ? (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold"
            aria-hidden
          >
            {subscription.name.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={subscription.logo_url ?? subscriptionLogoUrl(subscription.name)}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg bg-muted object-contain p-1.5"
            onError={() => setLogoFailed(true)}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{subscription.name}</p>
            <Badge
              variant="outline"
              className={cn("shrink-0 capitalize", STATUS_STYLE[subscription.status])}
            >
              {subscription.status}
            </Badge>
          </div>
          <p className="text-numeric mt-0.5 text-sm">
            {formatCAD(Number(subscription.amount))}
            <span className="text-muted-foreground">
              {CYCLE_LABEL[subscription.billing_cycle ?? "monthly"]}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {active ? (
              <>
                Renews {formatDateShort(subscription.next_billing_date)}
                <span
                  className={cn(
                    "text-numeric ml-1 font-medium",
                    days <= 3 ? "text-warning" : "text-foreground"
                  )}
                >
                  ({days < 0 ? "overdue" : days === 0 ? "today" : `${days}d`})
                </span>
              </>
            ) : (
              "Not renewing"
            )}
            {account && <> · {account.name}</>}
          </p>
        </div>

        <div className="-mr-2 flex shrink-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onEdit}
            aria-label={`Edit ${subscription.name}`}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${subscription.name}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
