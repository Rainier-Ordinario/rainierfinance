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
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("accounts")
        .upsert({ ...account, user_id: user.id });
      if (error) throw error;
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
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
