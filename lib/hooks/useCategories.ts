"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Category, CategoryKind } from "@/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useUpsertCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      category: Partial<Category> & Pick<Category, "name" | "icon" | "color">
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("categories")
        .upsert({ ...category, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Set whether a category is fixed, essential, or discretionary. */
export function useSetCategoryKind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: CategoryKind }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("categories")
        .update({ kind })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => {
      if (/kind/.test(err.message)) {
        toast.error(
          "Grouping categories needs a quick database update — run migration 005."
        );
      } else {
        toast.error(err.message);
      }
    },
  });
}
