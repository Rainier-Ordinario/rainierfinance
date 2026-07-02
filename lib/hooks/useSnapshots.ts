"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NetWorthSnapshot } from "@/types";

export function useSnapshots() {
  return useQuery({
    queryKey: ["net_worth_snapshots"],
    queryFn: async (): Promise<NetWorthSnapshot[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("*")
        .order("snapshot_date");
      if (error) throw error;
      return (data ?? []) as NetWorthSnapshot[];
    },
  });
}

export function useUpsertSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      snapshot: Partial<NetWorthSnapshot> &
        Pick<
          NetWorthSnapshot,
          "snapshot_date" | "total_assets" | "total_liabilities" | "net_worth"
        >
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("net_worth_snapshots")
        .upsert(
          { ...snapshot, user_id: user.id },
          { onConflict: "user_id,snapshot_date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["net_worth_snapshots"] });
      toast.success("Snapshot saved");
    },
    onError: (err) => toast.error(err.message),
  });
}
