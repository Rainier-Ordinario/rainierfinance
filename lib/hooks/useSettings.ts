"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PaymentReminder, Profile, UserSettings } from "@/types";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    onError: (err) => toast.error(err.message),
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
