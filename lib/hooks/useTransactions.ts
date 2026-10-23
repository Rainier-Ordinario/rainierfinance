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

const PAGE_SIZE = 1000;

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<Transaction[]> => {
      const supabase = createClient();
      let query = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        // Unique tie-breaker so pages never overlap or skip rows.
        .order("id");

      if (filters.search)
        query = query.ilike("description", `%${filters.search}%`);
      if (filters.accountIds?.length)
        query = query.in("account_id", filters.accountIds);
      if (filters.categories?.length)
        query = query.in("category", filters.categories);
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("date", filters.dateTo);
      // No explicit range → cap at the last 24 months so pages don't fetch
      // an ever-growing full history. Date filters override the cap.
      if (!filters.dateFrom && !filters.dateTo) {
        const floor = new Date();
        floor.setMonth(floor.getMonth() - 24);
        query = query.gte("date", floor.toISOString().slice(0, 10));
      }
      // Amount bounds are magnitudes (expenses are stored negative, income
      // and refunds positive), so match |amount| in [min, max].
      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        const min = filters.amountMin ?? 0;
        const max = filters.amountMax ?? Number.MAX_SAFE_INTEGER;
        query = query.or(
          `and(amount.gte.${min},amount.lte.${max}),and(amount.gte.${-max},amount.lte.${-min})`
        );
      }

      // PostgREST returns at most 1000 rows per request, so page until a
      // short page; otherwise older history silently drops off the charts.
      const rows: Transaction[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as Transaction[]));
        if ((data ?? []).length < PAGE_SIZE) break;
      }
      return rows;
    },
  });
}

/**
 * When any transaction was last added or edited (ignores page filters).
 * Shares the "transactions" key prefix, so every mutation here refreshes it.
 */
export function useTransactionsLastUpdated() {
  return useQuery({
    queryKey: ["transactions", "last-updated"],
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.updated_at ?? null;
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

/** Identity used for duplicate detection on re-import. */
function importDupKey(row: {
  date: string;
  description: string;
  amount: number;
  account_id?: string | null;
}): string {
  return `${row.account_id ?? ""}|${row.date}|${row.description}|${Number(
    row.amount
  ).toFixed(2)}`;
}

export interface ImportResult {
  inserted: number;
  /** Rows skipped because an identical one already exists (re-imported file). */
  skipped: number;
}

export function useImportTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactions,
      onProgress,
    }: {
      transactions: TransactionInput[];
      /** Called after each chunk with rows inserted so far and the total to insert. */
      onProgress?: (inserted: number, total: number) => void;
    }): Promise<ImportResult> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const rows = transactions.map((t) => ({ ...t, user_id: user.id }));
      if (rows.length === 0) return { inserted: 0, skipped: 0 };

      // Re-importing the same bank export must not double-count: skip rows
      // that already exist (same account + date + description + amount).
      // Occurrences are counted, so two genuine identical charges in a new
      // file still import when only one is in the database.
      const dates = rows.map((r) => r.date).sort();
      let existingQuery = supabase
        .from("transactions")
        .select("date,description,amount,account_id")
        .gte("date", dates[0])
        .lte("date", dates[dates.length - 1]);
      const accountIds = [
        ...new Set(rows.map((r) => r.account_id).filter(Boolean)),
      ] as string[];
      if (accountIds.length > 0)
        existingQuery = existingQuery.in("account_id", accountIds);
      const { data: existing, error: existingError } = await existingQuery;
      if (existingError) throw existingError;

      const existingCounts = new Map<string, number>();
      for (const e of existing ?? []) {
        const key = importDupKey(e);
        existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
      }
      const toInsert: typeof rows = [];
      let skipped = 0;
      for (const row of rows) {
        const key = importDupKey(row);
        const remaining = existingCounts.get(key) ?? 0;
        if (remaining > 0) {
          existingCounts.set(key, remaining - 1);
          skipped++;
        } else {
          toInsert.push(row);
        }
      }

      onProgress?.(0, toInsert.length);
      for (let i = 0; i < toInsert.length; i += IMPORT_CHUNK_SIZE) {
        const { error } = await supabase
          .from("transactions")
          .insert(toInsert.slice(i, i + IMPORT_CHUNK_SIZE));
        if (error) {
          throw new Error(
            `${error.message} (${i} of ${toInsert.length} rows were imported before the failure)`
          );
        }
        onProgress?.(
          Math.min(i + IMPORT_CHUNK_SIZE, toInsert.length),
          toInsert.length
        );
      }
      return { inserted: toInsert.length, skipped };
    },
    onSuccess: ({ inserted, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      if (inserted === 0 && skipped > 0) {
        toast.info(
          `Nothing new to import — all ${skipped} rows are already in your transactions`
        );
      } else if (skipped > 0) {
        toast.success(
          `Imported ${inserted} transactions (${skipped} duplicates skipped)`
        );
      } else {
        toast.success(`Imported ${inserted} transactions`);
      }
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

/**
 * Reclassify income rows as refunds: positive expenses in the given
 * category, so they lower that category's spending instead of adding income.
 */
export function useConvertToRefunds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { id: string; category: string }[]) => {
      const supabase = createClient();
      const byCategory = new Map<string, string[]>();
      for (const r of rows) {
        byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r.id]);
      }
      for (const [category, ids] of byCategory) {
        // Amounts stay positive: a positive expense is a refund.
        const { error } = await supabase
          .from("transactions")
          .update({ type: "expense", category })
          .in("id", ids);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        `Marked ${count} ${count === 1 ? "transaction" : "transactions"} as refunds`
      );
    },
    onError: (err) => toast.error(err.message),
  });
}
