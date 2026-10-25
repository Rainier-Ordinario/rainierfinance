"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createLinkToken,
  syncBanks,
  syncUntilHistoryReady,
  useExchangePublicToken,
} from "@/lib/hooks/useBankSync";

/**
 * Opens Plaid Link so the user signs in to their bank on the bank's own
 * page. With `itemId` it repairs that connection instead of adding one.
 */
export function ConnectBankButton({
  itemId,
  label,
  variant = "default",
  size = "default",
}: {
  itemId?: string;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const queryClient = useQueryClient();
  const exchange = useExchangePublicToken();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["plaid_items"] });
  }

  // Update mode (repairing a connection) succeeds without a public token.
  async function onSuccess(publicToken: string | null) {
    setToken(null);
    const toastId = toast.loading(
      itemId ? "Reconnected — syncing…" : "Connected — pulling your transactions…"
    );
    try {
      if (itemId || !publicToken) {
        const r = await syncBanks(itemId);
        toast.success(`Reconnected · ${r.added} new transactions`, { id: toastId });
      } else {
        await exchange.mutateAsync(publicToken);
        refresh();
        const added = await syncUntilHistoryReady((n) => {
          refresh();
          toast.loading(`Connected — ${n} transactions so far…`, { id: toastId });
        });
        toast.success(
          `Bank connected · ${added} transactions imported. New ones will sync automatically.`,
          { id: toastId }
        );
      }
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      refresh();
      setBusy(false);
    }
  }

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => {
      setToken(null);
      setBusy(false);
    },
  });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  async function start() {
    setBusy(true);
    try {
      setToken(await createLinkToken(itemId));
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={start} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Landmark className="size-4" aria-hidden />
      )}
      {label ?? (itemId ? "Reconnect" : "Connect bank")}
    </Button>
  );
}
