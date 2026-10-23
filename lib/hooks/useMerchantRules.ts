"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUserSettings } from "@/lib/hooks/useSettings";
import { merchantKey, type MerchantRules } from "@/lib/utils/categorize";
import { UNCATEGORIZED } from "@/lib/utils/spending";

const PAGE_SIZE = 1000;
const UPDATE_CHUNK_SIZE = 200;

/** The user's learned merchant → category rules ({} before migration 005). */
export function useMerchantRules(): MerchantRules {
  return useUserSettings().data?.merchant_rules ?? {};
}

/**
 * Remember that these merchants belong in `category`: save a rule per
 * merchant so future imports land there, and move every past expense from
 * the same merchants over too, so one correction fixes the whole history.
 */
export function useLearnMerchantCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      descriptions,
      category,
    }: {
      descriptions: string[];
      category: string;
    }): Promise<{ merchants: number; updated: number }> => {
      const keys = [
        ...new Set(descriptions.map(merchantKey).filter(Boolean)),
      ];
      if (keys.length === 0 || category === UNCATEGORIZED) {
        return { merchants: 0, updated: 0 };
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: existing, error: readError } = await supabase
        .from("user_settings")
        .select("merchant_rules")
        .maybeSingle();
      if (readError) throw readError;
      const rules: MerchantRules = {
        ...((existing?.merchant_rules as MerchantRules | null) ?? {}),
        ...Object.fromEntries(keys.map((k) => [k, category])),
      };
      const { error: saveError } = await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, merchant_rules: rules });
      if (saveError) throw saveError;

      // Narrow server-side by each merchant's longest word, then match the
      // exact key here. Paged because PostgREST caps rows per request.
      const words = keys.map(
        (k) => k.split(" ").sort((a, b) => b.length - a.length)[0]
      );
      const matchIds: string[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("transactions")
          .select("id,description,category")
          .eq("type", "expense")
          .neq("category", category)
          .or(words.map((w) => `description.ilike.%${w}%`).join(","))
          .order("id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        for (const t of data ?? []) {
          if (keys.includes(merchantKey(t.description))) matchIds.push(t.id);
        }
        if ((data ?? []).length < PAGE_SIZE) break;
      }

      for (let i = 0; i < matchIds.length; i += UPDATE_CHUNK_SIZE) {
        const { error } = await supabase
          .from("transactions")
          .update({ category })
          .in("id", matchIds.slice(i, i + UPDATE_CHUNK_SIZE));
        if (error) throw error;
      }
      return { merchants: keys.length, updated: matchIds.length };
    },
    onSuccess: ({ merchants, updated }, { category }) => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
      if (merchants === 0) return;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      const who = merchants === 1 ? "this merchant" : `these ${merchants} merchants`;
      toast.success(
        updated > 0
          ? `Moved ${updated} other past ${updated === 1 ? "charge" : "charges"} to ${category}. Future ones from ${who} will follow.`
          : `Remembered: future charges from ${who} go to ${category}.`
      );
    },
    onError: (err) => {
      if (/merchant_rules/.test(err.message)) {
        toast.error(
          "Remembering categories needs a quick database update — run migration 005."
        );
      } else {
        toast.error(err.message);
      }
    },
  });
}
