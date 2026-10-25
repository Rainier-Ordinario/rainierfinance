import type {
  AccountBase,
  RemovedTransaction,
  Transaction as PlaidTransaction,
} from "plaid";
import { TransactionsUpdateStatus } from "plaid";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/plaid/crypto";
import { plaidClient, plaidErrorCode } from "@/lib/plaid/client";
import {
  appAccountType,
  dropCsvOverlap,
  mapPlaidTransactions,
} from "@/lib/plaid/mapping";
import {
  knownMerchantsFrom,
  type MerchantRules,
} from "@/lib/utils/categorize";
import type { PlaidItem } from "@/types";

// Server-only: runs with the service-role client, so every query below is
// scoped to the item's user_id by hand.

type Admin = ReturnType<typeof createAdminClient>;

const CHUNK = 200;
const PAGE_SIZE = 1000;

function chunks<T>(rows: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function accessTokenFor(admin: Admin, item: PlaidItem) {
  const { data, error } = await admin
    .from("plaid_item_tokens")
    .select("access_token_encrypted")
    .eq("plaid_item_id", item.id)
    .single();
  if (error) throw error;
  return decryptToken(data.access_token_encrypted);
}

/** Balance as the app stores it: what's held, or what's owed on a card. */
function balanceOf(account: AccountBase): number {
  return Number(account.balances.current ?? account.balances.available ?? 0);
}

/**
 * Make sure every Plaid account on the item has an app account and refresh
 * balances. A new Plaid account is matched to an existing unlinked account
 * with the same last 4 digits and type (one the user built up from CSVs),
 * and Plaid rows for it start from that account's last recorded day.
 */
export async function linkAccounts(
  admin: Admin,
  item: PlaidItem,
  plaidAccounts: AccountBase[]
) {
  const { data: existing, error } = await admin
    .from("accounts")
    .select("id,type,account_number_last4,plaid_account_id")
    .eq("user_id", item.user_id);
  if (error) throw error;

  for (const pa of plaidAccounts) {
    const type = appAccountType(pa);
    if (!type) continue;
    const fresh = {
      balance: balanceOf(pa),
      ...(type === "credit_card" && pa.balances.limit != null
        ? { credit_limit: pa.balances.limit }
        : {}),
    };

    const linked = existing?.find((a) => a.plaid_account_id === pa.account_id);
    if (linked) {
      const { error: e } = await admin
        .from("accounts")
        .update({ ...fresh, plaid_item_id: item.id, is_active: true })
        .eq("id", linked.id);
      if (e) throw e;
      continue;
    }

    const match = existing?.find(
      (a) =>
        !a.plaid_account_id &&
        a.type === type &&
        pa.mask &&
        a.account_number_last4 === pa.mask
    );
    if (match) {
      const { data: last } = await admin
        .from("transactions")
        .select("date")
        .eq("account_id", match.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error: e } = await admin
        .from("accounts")
        .update({
          ...fresh,
          plaid_item_id: item.id,
          plaid_account_id: pa.account_id,
          plaid_sync_from: last?.date ?? null,
          is_active: true,
        })
        .eq("id", match.id);
      if (e) throw e;
      match.plaid_account_id = pa.account_id;
      continue;
    }

    const { error: e } = await admin.from("accounts").insert({
      ...fresh,
      user_id: item.user_id,
      name: pa.official_name || pa.name,
      type,
      institution: item.institution_name,
      currency: pa.balances.iso_currency_code ?? "CAD",
      account_number_last4: pa.mask,
      plaid_item_id: item.id,
      plaid_account_id: pa.account_id,
    });
    if (e) throw e;
  }
}

async function loadRules(admin: Admin, userId: string): Promise<MerchantRules> {
  const { data, error } = await admin
    .from("user_settings")
    .select("merchant_rules")
    .eq("user_id", userId)
    .maybeSingle();
  // Before migration 005 there are no learned rules.
  if (error) return {};
  return (data?.merchant_rules as MerchantRules | null) ?? {};
}

/** The user's past year of purchases, so refunds from those merchants are recognized. */
async function loadRecentExpenses(admin: Admin, userId: string) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const rows: { description: string; category: string; type: string; date: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("transactions")
      .select("description,category,type,date")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", since.toISOString().slice(0, 10))
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

/** Pull every change since the saved cursor, restarting if Plaid's data shifts mid-way. */
async function fetchChanges(accessToken: string, cursor: string | null) {
  const plaid = plaidClient();
  for (let attempt = 0; ; attempt++) {
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: RemovedTransaction[] = [];
    let next = cursor ?? undefined;
    let status: TransactionsUpdateStatus | undefined;
    try {
      for (;;) {
        const { data } = await plaid.transactionsSync({
          access_token: accessToken,
          cursor: next,
          count: 500,
        });
        added.push(...data.added);
        modified.push(...data.modified);
        removed.push(...data.removed);
        next = data.next_cursor;
        status = data.transactions_update_status;
        if (!data.has_more) break;
      }
      return { added, modified, removed, cursor: next ?? null, status };
    } catch (err) {
      if (
        plaidErrorCode(err) === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
        attempt < 3
      ) {
        continue;
      }
      throw err;
    }
  }
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  /** False while Plaid is still fetching the account's history after linking. */
  historyReady: boolean;
}

async function applyChanges(
  admin: Admin,
  item: PlaidItem,
  changes: Awaited<ReturnType<typeof fetchChanges>>
): Promise<Omit<SyncResult, "historyReady">> {
  const { data: accounts, error: accountsError } = await admin
    .from("accounts")
    .select("id,plaid_account_id,plaid_sync_from")
    .eq("user_id", item.user_id)
    .eq("plaid_item_id", item.id);
  if (accountsError) throw accountsError;
  const byPlaidId = new Map(
    (accounts ?? [])
      .filter((a) => a.plaid_account_id)
      .map((a) => [a.plaid_account_id as string, a])
  );

  const rules = await loadRules(admin, item.user_id);
  const known = knownMerchantsFrom(await loadRecentExpenses(admin, item.user_id));
  const mapped = mapPlaidTransactions(changes.added, rules, known).filter((t) =>
    byPlaidId.has(t.plaid_account_id)
  );

  // A pending charge that posts arrives as a new transaction naming the
  // pending one; update that row in place so its category, notes and
  // splits survive. (The pending id then shows up in `removed`, a no-op.)
  const pendingIds = changes.added
    .map((t) => t.pending_transaction_id)
    .filter((id): id is string => Boolean(id));
  const pendingRows = new Map<
    string,
    { id: string; split_group: string | null }
  >();
  for (const ids of chunks(pendingIds)) {
    const { data, error } = await admin
      .from("transactions")
      .select("id,plaid_transaction_id,split_group")
      .eq("user_id", item.user_id)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
    for (const r of data ?? []) pendingRows.set(r.plaid_transaction_id, r);
  }

  const pendingIdOf = new Map(
    changes.added.map((a) => [a.transaction_id, a.pending_transaction_id])
  );
  let updated = 0;
  const fresh: typeof mapped = [];
  for (const t of mapped) {
    const pendingId = pendingIdOf.get(t.plaid_transaction_id);
    const row = pendingId ? pendingRows.get(pendingId) : undefined;
    if (!row) {
      fresh.push(t);
      continue;
    }
    const { error } = await admin
      .from("transactions")
      .update({
        plaid_transaction_id: t.plaid_transaction_id,
        pending: t.pending,
        date: t.date,
        ...(row.split_group
          ? { split_original_amount: t.amount }
          : { amount: t.amount }),
      })
      .eq("id", row.id);
    if (error) throw error;
    updated++;
  }

  // Skip what an account's CSV history already has.
  const toInsert: Record<string, unknown>[] = [];
  for (const account of byPlaidId.values()) {
    const rows = fresh.filter((t) => t.plaid_account_id === account.plaid_account_id);
    if (rows.length === 0) continue;
    let existingAmounts: number[] = [];
    if (account.plaid_sync_from) {
      const { data, error } = await admin
        .from("transactions")
        .select("amount,split_original_amount,split_group")
        .eq("account_id", account.id)
        .eq("date", account.plaid_sync_from);
      if (error) throw error;
      const seen = new Set<string>();
      existingAmounts = (data ?? []).flatMap((r) => {
        if (!r.split_group) return [Number(r.amount)];
        if (seen.has(r.split_group)) return [];
        seen.add(r.split_group);
        return [Number(r.split_original_amount ?? r.amount)];
      });
    }
    for (const t of dropCsvOverlap(rows, account.plaid_sync_from, existingAmounts)) {
      toInsert.push({
        user_id: item.user_id,
        account_id: account.id,
        plaid_transaction_id: t.plaid_transaction_id,
        pending: t.pending,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        type: t.type,
      });
    }
  }
  for (const batch of chunks(toInsert)) {
    // ignoreDuplicates keeps a retried sync from failing on rows it already added.
    const { error } = await admin
      .from("transactions")
      .upsert(batch, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  // Corrections from the bank: keep the user's category and description,
  // take the new amount, date and pending state.
  for (const t of changes.modified) {
    const { data: rows, error } = await admin
      .from("transactions")
      .select("id,split_group")
      .eq("user_id", item.user_id)
      .eq("plaid_transaction_id", t.transaction_id);
    if (error) throw error;
    const row = rows?.[0];
    if (!row) continue;
    const { error: e } = await admin
      .from("transactions")
      .update({
        pending: t.pending,
        date: t.authorized_date ?? t.date,
        ...(row.split_group
          ? { split_original_amount: -t.amount }
          : { amount: -t.amount }),
      })
      .eq("id", row.id);
    if (e) throw e;
    updated++;
  }

  // Removed by the bank (mostly pending charges that dropped off). A split
  // row takes its sibling parts with it.
  let removed = 0;
  for (const ids of chunks(changes.removed.map((r) => r.transaction_id))) {
    const { data: rows, error } = await admin
      .from("transactions")
      .select("id,split_group")
      .eq("user_id", item.user_id)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
    for (const row of rows ?? []) {
      const { error: e } = row.split_group
        ? await admin
            .from("transactions")
            .delete()
            .eq("user_id", item.user_id)
            .eq("split_group", row.split_group)
        : await admin.from("transactions").delete().eq("id", row.id);
      if (e) throw e;
      removed++;
    }
  }

  return { added: toInsert.length, updated, removed };
}

/**
 * Bring one bank connection up to date: balances, new accounts, and every
 * transaction change since the last sync. Marks the item as needing a
 * re-login when the bank asks for one.
 */
export async function syncItem(admin: Admin, item: PlaidItem): Promise<SyncResult> {
  try {
    const accessToken = await accessTokenFor(admin, item);
    const { data: accountsData } = await plaidClient().accountsGet({
      access_token: accessToken,
    });
    await linkAccounts(admin, item, accountsData.accounts);

    const changes = await fetchChanges(accessToken, item.cursor);
    const result = await applyChanges(admin, item, changes);

    const { error } = await admin
      .from("plaid_items")
      .update({
        cursor: changes.cursor,
        status: "active",
        error_code: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) throw error;

    return {
      ...result,
      historyReady:
        changes.status === TransactionsUpdateStatus.HistoricalUpdateComplete,
    };
  } catch (err) {
    const code = plaidErrorCode(err);
    if (code) {
      await admin
        .from("plaid_items")
        .update({
          status: code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error",
          error_code: code,
        })
        .eq("id", item.id);
    }
    throw err;
  }
}
