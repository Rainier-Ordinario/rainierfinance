"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isMissingTable } from "@/lib/hooks/useGoals";
import type { PlaidItem } from "@/types";

/** Sync automatically when the last sync is older than this. */
const STALE_MS = 4 * 60 * 60 * 1000;

async function postJson<T>(url: string, body: unknown = {}, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** The user's linked banks ([] before migration 008). */
export function usePlaidItems() {
  return useQuery({
    queryKey: ["plaid_items"],
    retry: (count, err) => !isMissingTable(err) && count < 2,
    queryFn: async (): Promise<PlaidItem[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("plaid_items")
        .select("*")
        .order("created_at");
      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }
      return (data ?? []) as PlaidItem[];
    },
  });
}

export interface SyncResponse {
  added: number;
  updated: number;
  removed: number;
  historyReady: boolean;
  failures: string[];
}

export function syncBanks(itemId?: string) {
  return postJson<SyncResponse>(
    "/api/plaid/sync",
    itemId ? { plaid_item_id: itemId } : {}
  );
}

function invalidateBankData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["accounts"] });
  queryClient.invalidateQueries({ queryKey: ["plaid_items"] });
}

type SyncVars = { itemId?: string; silent?: boolean };

export function useSyncBanks() {
  const queryClient = useQueryClient();
  return useMutation<SyncResponse, Error, SyncVars>({
    mutationFn: ({ itemId }) => syncBanks(itemId),
    onSuccess: (r, { silent }) => {
      invalidateBankData(queryClient);
      if (r.failures.length > 0) {
        toast.error(
          `Couldn't sync ${r.failures.join(", ")} — check Settings → Bank connections.`
        );
      } else if (!silent) {
        toast.success(
          r.added > 0
            ? `Synced ${r.added} new ${r.added === 1 ? "transaction" : "transactions"}`
            : "Up to date — nothing new from your bank"
        );
      }
    },
    onError: (err, { silent }) => {
      invalidateBankData(queryClient);
      if (!silent) toast.error(err.message);
    },
  });
}

/**
 * Right after linking, Plaid is still fetching up to two years of history.
 * Sync, then keep syncing every few seconds until it says it's done.
 */
export async function syncUntilHistoryReady(
  onProgress: (added: number) => void
): Promise<number> {
  let added = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const r = await syncBanks();
    added += r.added;
    onProgress(added);
    if (r.historyReady) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return added;
}

export function useExchangePublicToken() {
  return useMutation({
    mutationFn: (publicToken: string) =>
      postJson<{ item: PlaidItem }>("/api/plaid/exchange", {
        public_token: publicToken,
      }),
  });
}

export function useDisconnectBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      postJson(`/api/plaid/items/${itemId}`, {}, "DELETE"),
    onSuccess: () => {
      invalidateBankData(queryClient);
      toast.success("Bank disconnected — its past transactions are kept");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function createLinkToken(itemId?: string) {
  return postJson<{ link_token: string }>(
    "/api/plaid/link-token",
    itemId ? { plaid_item_id: itemId } : {}
  ).then((r) => r.link_token);
}

/**
 * Sync quietly once per page load when a bank hasn't synced in a while, so
 * the app stays current even without webhooks (e.g. running locally).
 */
export function useAutoSync() {
  const items = usePlaidItems();
  const sync = useSyncBanks();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !items.data) return;
    const stale = items.data.some(
      (i) =>
        i.status === "active" &&
        (!i.last_synced_at ||
          Date.now() - new Date(i.last_synced_at).getTime() > STALE_MS)
    );
    if (!stale) return;
    started.current = true;
    sync.mutate({ silent: true });
  }, [items.data, sync]);
}
