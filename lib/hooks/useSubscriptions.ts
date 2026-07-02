"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Subscription } from "@/types";

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async (): Promise<Subscription[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("next_billing_date");
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });
}

export function useUpsertSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      subscription: Partial<Subscription> &
        Pick<Subscription, "name" | "amount" | "next_billing_date">
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("subscriptions")
        .upsert({ ...subscription, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
