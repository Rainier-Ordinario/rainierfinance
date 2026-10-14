"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { rolledBillingDate } from "@/lib/utils/subscriptions";
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

      // Renewal dates that have passed roll forward to the next charge and
      // are saved back, so nobody has to bump them by hand each cycle.
      const subs = (data ?? []) as Subscription[];
      const rolled = subs.map((s) => ({
        ...s,
        next_billing_date: rolledBillingDate(s),
      }));
      const stale = rolled.filter(
        (s, i) => s.next_billing_date !== subs[i].next_billing_date
      );
      if (stale.length > 0) {
        await Promise.all(
          stale.map((s) =>
            supabase
              .from("subscriptions")
              .update({ next_billing_date: s.next_billing_date })
              .eq("id", s.id)
          )
        );
      }
      return rolled.sort((a, b) =>
        a.next_billing_date.localeCompare(b.next_billing_date)
      );
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
