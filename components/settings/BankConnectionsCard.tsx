"use client";

import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Landmark, RefreshCw, Unplug } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectBankButton } from "@/components/bank/ConnectBankButton";
import {
  useDisconnectBank,
  usePlaidItems,
  useSyncBanks,
} from "@/lib/hooks/useBankSync";
import type { Account, PlaidItem } from "@/types";

const STATUS_BADGE: Record<
  PlaidItem["status"],
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Syncing", variant: "secondary" },
  login_required: { label: "Sign-in needed", variant: "destructive" },
  error: { label: "Error", variant: "destructive" },
};

export function BankConnectionsCard({ accounts }: { accounts: Account[] }) {
  const items = usePlaidItems();
  const sync = useSyncBanks();
  const disconnect = useDisconnectBank();
  const [removing, setRemoving] = useState<PlaidItem | null>(null);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Bank connections</CardTitle>
          <CardDescription>
            Transactions and balances sync from your bank automatically. You
            sign in on your bank&apos;s own page; this app never sees your
            password.
          </CardDescription>
        </div>
        <ConnectBankButton size="sm" />
      </CardHeader>
      <CardContent>
        {(items.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No banks connected yet. Connect one to stop importing CSVs.
          </p>
        ) : (
          <ul className="divide-y">
            {(items.data ?? []).map((item) => {
              const linked = accounts.filter((a) => a.plaid_item_id === item.id);
              const badge = STATUS_BADGE[item.status];
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.institution_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {linked.length > 0
                        ? linked.map((a) => a.name).join(", ")
                        : "No accounts"}
                      {" · "}
                      {item.last_synced_at
                        ? `synced ${formatDistanceToNow(parseISO(item.last_synced_at), { addSuffix: true })}`
                        : "not synced yet"}
                    </p>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <div className="flex gap-1">
                    {item.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sync.mutate({ itemId: item.id })}
                        disabled={sync.isPending}
                      >
                        <RefreshCw
                          className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`}
                          aria-hidden
                        />
                        Sync
                      </Button>
                    ) : (
                      <ConnectBankButton itemId={item.id} variant="outline" size="sm" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoving(item)}
                      aria-label={`Disconnect ${item.institution_name}`}
                    >
                      <Unplug className="size-3.5 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {removing?.institution_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The app stops syncing and gives up access to this bank. Accounts
              and past transactions stay; reconnecting later picks up where it
              left off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (removing) disconnect.mutate(removing.id);
                setRemoving(null);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
