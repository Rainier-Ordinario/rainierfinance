"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/types";

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async (): Promise<Budget[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      budget: Partial<Budget> & Pick<Budget, "name" | "total_amount">
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("budgets")
        .upsert({ ...budget, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
