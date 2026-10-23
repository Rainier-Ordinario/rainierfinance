"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PaymentReminder, Profile, UserSettings } from "@/types";

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const supabase = createClient();
      // getSession reads locally (no auth-server round trip), so consumers
      // like the greeting get user_metadata without waiting on the network.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUserSettings() {
  return useQuery({
    queryKey: ["user_settings"],
    queryFn: async (): Promise<UserSettings | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as UserSettings | null;
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_settings")
        .upsert({ ...patch, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
      toast.success("Settings saved");
    },
    onError: (err) => {
      // A column from a migration that hasn't been run yet.
      if (/column|schema cache/i.test(err.message)) {
        toast.error(
          "This setting needs a quick database update — run the latest file in supabase/migrations."
        );
      } else {
        toast.error(err.message);
      }
    },
  });
}

/**
 * Add a normalized merchant key to the user's dismissed-recurring list.
 * Quiet on success (the row just disappears); explains the missing-column
 * case if migration 002 hasn't been applied.
 */
export function useDismissRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: existing } = await supabase
        .from("user_settings")
        .select("dismissed_recurring")
        .maybeSingle();
      const current = (existing?.dismissed_recurring as string[] | null) ?? [];
      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        dismissed_recurring: [...new Set([...current, key])],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
    },
    onError: (err) => {
      if (/dismissed_recurring/.test(err.message)) {
        toast.error(
          "Dismissing needs a quick database update — run migration 002."
        );
      } else {
        toast.error(err.message);
      }
    },
  });
}

export function usePaymentReminders() {
  return useQuery({
    queryKey: ["payment_reminders"],
    queryFn: async (): Promise<PaymentReminder[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("*");
      if (error) throw error;
      return (data ?? []) as PaymentReminder[];
    },
  });
}

export function useUpsertPaymentReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reminder: Partial<PaymentReminder>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("payment_reminders")
        .upsert({ ...reminder, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_reminders"] });
      toast.success("Payment settings saved");
    },
    onError: (err) => toast.error(err.message),
  });
}
