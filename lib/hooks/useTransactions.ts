"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  dedupeImport,
  splitError,
  type DedupRow,
  type SplitPart,
} from "@/lib/utils/importDedup";
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

const SPLIT_COLUMNS = "split_group,split_original_amount";

/**
 * Rows already stored in the date range, paged past PostgREST's row cap.
 * Falls back to plain columns before migration 007 adds the split ones.
 */
async function fetchExistingForDedup(
  from: string,
  to: string,
  accountIds: string[]
): Promise<DedupRow[]> {
  const supabase = createClient();
  const page = (columns: string, offset: number) => {
    let q = supabase
      .from("transactions")
      .select(columns)
      .gte("date", from)
      .lte("date", to)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (accountIds.length > 0) q = q.in("account_id", accountIds);
    return q;
  };
  let columns = `date,description,amount,account_id,${SPLIT_COLUMNS}`;
  const rows: DedupRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let { data, error } = await page(columns, offset);
    if (error && /split_/.test(error.message)) {
      columns = "date,description,amount,account_id";
      ({ data, error } = await page(columns, offset));
    }
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as DedupRow[]));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
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
      const accountIds = [
        ...new Set(rows.map((r) => r.account_id).filter(Boolean)),
      ] as string[];
      const existing = await fetchExistingForDedup(
        dates[0],
        dates[dates.length - 1],
        accountIds
      );
      const { toInsert, skipped } = dedupeImport(rows, existing);

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

/**
 * Split one transaction into parts in different categories. The original
 * row becomes the first part; the rest are new rows sharing a split_group.
 */
export function useSplitTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transaction,
      parts,
    }: {
      transaction: Transaction;
      parts: SplitPart[];
    }) => {
      const error = splitError(Number(transaction.amount), parts);
      if (error) throw new Error(error);
      const supabase = createClient();
      const sign = Number(transaction.amount) < 0 ? -1 : 1;
      const group = crypto.randomUUID();
      const shared = {
        split_group: group,
        split_original_amount: Number(transaction.amount),
      };
      const [first, ...rest] = parts;
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ ...shared, category: first.category, amount: sign * first.amount })
        .eq("id", transaction.id);
      if (updateError) throw updateError;
      const { error: insertError } = await supabase.from("transactions").insert(
        rest.map((p) => ({
          ...shared,
          user_id: transaction.user_id,
          account_id: transaction.account_id,
          date: transaction.date,
          description: transaction.description,
          type: transaction.type,
          is_recurring: false,
          notes: transaction.notes,
          category: p.category,
          amount: sign * p.amount,
        }))
      );
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction split");
    },
    onError: (err) =>
      toast.error(
        /split_/.test(err.message)
          ? "Splitting needs a quick database update — run migration 007."
          : err.message
      ),
  });
}

/** Merge a split back into one row with the bank's original amount. */
export function useUnsplitTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transaction: Transaction) => {
      if (!transaction.split_group) return;
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("split_group", transaction.split_group)
        .neq("id", transaction.id);
      if (deleteError) throw deleteError;
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: transaction.split_original_amount,
          split_group: null,
          split_original_amount: null,
        })
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Split undone");
    },
    onError: (err) => toast.error(err.message),
  });
}
