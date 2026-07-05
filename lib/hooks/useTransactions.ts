"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionType } from "@/types";

export interface TransactionFilters {
  search?: string;
  accountIds?: string[];
  categories?: string[];
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<Transaction[]> => {
      const supabase = createClient();
      let query = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.search)
        query = query.ilike("description", `%${filters.search}%`);
      if (filters.accountIds?.length)
        query = query.in("account_id", filters.accountIds);
      if (filters.categories?.length)
        query = query.in("category", filters.categories);
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("date", filters.dateTo);
      if (filters.amountMin !== undefined)
        query = query.gte("amount", filters.amountMin);
      if (filters.amountMax !== undefined)
        query = query.lte("amount", filters.amountMax);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });
}

type TransactionInput = Partial<Transaction> &
  Pick<Transaction, "amount" | "description" | "category" | "date" | "type">;

export function useUpsertTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transaction: TransactionInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("transactions")
        .upsert({ ...transaction, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction saved");
    },
    onError: (err) => toast.error(err.message),
  });
}

const IMPORT_CHUNK_SIZE = 250;

export function useImportTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactions,
      onProgress,
    }: {
      transactions: TransactionInput[];
      /** Called with the number of rows inserted so far after each chunk. */
      onProgress?: (inserted: number) => void;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const rows = transactions.map((t) => ({ ...t, user_id: user.id }));
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
        const { error } = await supabase
          .from("transactions")
          .insert(rows.slice(i, i + IMPORT_CHUNK_SIZE));
        if (error) {
          throw new Error(
            `${error.message} (${i} of ${rows.length} rows were imported before the failure)`
          );
        }
        onProgress?.(Math.min(i + IMPORT_CHUNK_SIZE, rows.length));
      }
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`Imported ${count} transactions`);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("transactions")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useBulkCategorize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, category }: { ids: string[]; category: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("transactions")
        .update({ category })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Categorized");
    },
    onError: (err) => toast.error(err.message),
  });
}
