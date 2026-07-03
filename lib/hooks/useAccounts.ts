"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/types";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
}

export function useUpsertAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      account: Partial<Account> & Pick<Account, "name" | "type" | "institution">
    ): Promise<Account> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("accounts")
        .upsert({ ...account, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      // payment_reminders/subscriptions/investments reference accounts
      // without ON DELETE actions, so detach them first (transactions
      // cascade at the DB level).
      const { error: reminderError } = await supabase
        .from("payment_reminders")
        .delete()
        .eq("account_id", id);
      if (reminderError) throw reminderError;
      for (const table of ["subscriptions", "investments"] as const) {
        const { error } = await supabase
          .from(table)
          .update({ account_id: null })
          .eq("account_id", id);
        if (error) throw error;
      }
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_reminders"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Account deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
