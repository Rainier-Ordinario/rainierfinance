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
