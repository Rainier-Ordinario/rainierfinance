"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Investment } from "@/types";

export function useInvestments() {
  return useQuery({
    queryKey: ["investments"],
    queryFn: async (): Promise<Investment[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .order("market_value", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Investment[];
    },
  });
}

type InvestmentInput = Partial<Investment> &
  Pick<Investment, "symbol" | "name" | "quantity" | "average_cost">;

/** Fill in derived value/gain columns from quantity, cost, and price. */
export function withDerivedFields<T extends InvestmentInput>(inv: T): T {
  const price = inv.current_price ?? null;
  if (price === null) return inv;
  const marketValue = inv.quantity * price;
  const bookValue = inv.quantity * inv.average_cost;
  const gain = marketValue - bookValue;
  return {
    ...inv,
    market_value: Math.round(marketValue * 100) / 100,
    unrealized_gain: Math.round(gain * 100) / 100,
    unrealized_gain_pct:
      bookValue > 0 ? Math.round((gain / bookValue) * 10000) / 100 : 0,
  };
}

export function useUpsertInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (investment: InvestmentInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("investments")
        .upsert({ ...withDerivedFields(investment), user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Holding saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useImportInvestments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      investments,
      replaceAccountTypes,
    }: {
      investments: InvestmentInput[];
      /**
       * Holdings reports are snapshots: pass the account types covered by
       * the file so existing positions there are replaced, not duplicated.
       */
      replaceAccountTypes?: string[];
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (replaceAccountTypes && replaceAccountTypes.length > 0) {
        const { error: delError } = await supabase
          .from("investments")
          .delete()
          .eq("user_id", user.id)
          .in("account_type", replaceAccountTypes);
        if (delError) throw delError;
      }
      const rows = investments.map((i) => ({
        ...withDerivedFields(i),
        user_id: user.id,
      }));
      const { error } = await supabase.from("investments").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success(`Imported ${count} holdings`);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("investments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Holding deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
