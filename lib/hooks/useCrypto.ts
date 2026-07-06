"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { CryptoHolding } from "@/types";

export function useCryptoHoldings() {
  return useQuery({
    queryKey: ["crypto_holdings"],
    queryFn: async (): Promise<CryptoHolding[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("crypto_holdings")
        .select("*")
        .order("market_value_cad", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CryptoHolding[];
    },
  });
}

type CryptoInput = Partial<CryptoHolding> &
  Pick<CryptoHolding, "symbol" | "name" | "quantity" | "average_cost_cad">;

function withDerived<T extends CryptoInput>(holding: T): T {
  const price = holding.current_price_cad ?? null;
  if (price === null) return holding;
  const marketValue = holding.quantity * price;
  const bookValue = holding.quantity * holding.average_cost_cad;
  const gain = marketValue - bookValue;
  return {
    ...holding,
    market_value_cad: Math.round(marketValue * 100) / 100,
    unrealized_gain_cad: Math.round(gain * 100) / 100,
    unrealized_gain_pct:
      bookValue > 0 ? Math.round((gain / bookValue) * 10000) / 100 : 0,
  };
}

export function useUpsertCryptoHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (holding: CryptoInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("crypto_holdings")
        .upsert({ ...withDerived(holding), user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crypto_holdings"] });
      toast.success("Holding saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

/**
 * Import aggregated holdings (e.g. from a Coinbase export): updates rows for
 * symbols the user already tracks, inserts the rest.
 */
export function useImportCryptoHoldings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      holdings: Pick<
        CryptoHolding,
        "symbol" | "name" | "quantity" | "average_cost_cad"
      >[]
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: existing, error: readError } = await supabase
        .from("crypto_holdings")
        .select("id,symbol")
        .eq("user_id", user.id);
      if (readError) throw readError;
      const idBySymbol = new Map(
        (existing ?? []).map((h) => [h.symbol.toUpperCase(), h.id])
      );
      const rows = holdings.map((h) => ({
        ...(idBySymbol.has(h.symbol.toUpperCase())
          ? { id: idBySymbol.get(h.symbol.toUpperCase()) }
          : {}),
        symbol: h.symbol.toUpperCase(),
        name: h.name,
        quantity: h.quantity,
        average_cost_cad: h.average_cost_cad,
        user_id: user.id,
      }));
      const { error } = await supabase.from("crypto_holdings").upsert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["crypto_holdings"] });
      toast.success(`Imported ${count} holding${count === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRefreshCryptoPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: CryptoHolding[]) => {
      const supabase0 = createClient();
      let holdings = input;
      if (!holdings) {
        // No list given — refresh everything the user holds.
        const { data, error } = await supabase0
          .from("crypto_holdings")
          .select("*");
        if (error) throw error;
        holdings = (data ?? []) as CryptoHolding[];
      }
      if (holdings.length === 0) return 0;
      const symbols = [...new Set(holdings.map((h) => h.symbol))];
      const res = await fetch(
        `/api/crypto/prices?symbols=${symbols.join(",")}`
      );
      if (!res.ok) throw new Error("Price lookup failed");
      const { prices } = (await res.json()) as {
        prices: Record<string, number | null>;
      };

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const priced = holdings.filter(
        (h) => prices[h.symbol.toUpperCase()] != null
      );
      if (priced.length === 0)
        throw new Error("No live prices found for your symbols");

      const rows = priced.map((h) =>
        withDerived({
          ...h,
          quantity: Number(h.quantity),
          average_cost_cad: Number(h.average_cost_cad),
          current_price_cad: prices[h.symbol.toUpperCase()] as number,
          last_updated: new Date().toISOString(),
          user_id: user.id,
        })
      );
      const { error } = await supabase.from("crypto_holdings").upsert(rows);
      if (error) throw error;
      return priced.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["crypto_holdings"] });
      if (count > 0) toast.success(`Prices updated for ${count} holding${count === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteCryptoHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("crypto_holdings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crypto_holdings"] });
      toast.success("Holding deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
