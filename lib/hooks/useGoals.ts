"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Challenge, Goal } from "@/types";

/** A table from a migration that hasn't been run yet. */
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "PGRST205" ||
    e?.code === "42P01" ||
    /does not exist|could not find the table/i.test(e?.message ?? "")
  );
}

function errorToast(err: Error) {
  toast.error(
    isMissingTable(err)
      ? "This needs a quick database update — run migration 007."
      : err.message
  );
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    retry: (count, err) => !isMissingTable(err) && count < 2,
    queryFn: async (): Promise<Goal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export function useUpsertGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      goal: Partial<Goal> & Pick<Goal, "name" | "target_amount">
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("goals")
        .upsert({ ...goal, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal saved");
    },
    onError: errorToast,
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal deleted");
    },
    onError: errorToast,
  });
}

export function useChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    retry: (count, err) => !isMissingTable(err) && count < 2,
    queryFn: async (): Promise<Challenge[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });
}

export function useUpsertChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      challenge: Partial<Challenge> &
        Pick<Challenge, "kind" | "target" | "month">
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("challenges")
        .upsert({ ...challenge, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge started");
    },
    onError: errorToast,
  });
}

export function useDeleteChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success("Challenge removed");
    },
    onError: errorToast,
  });
}
