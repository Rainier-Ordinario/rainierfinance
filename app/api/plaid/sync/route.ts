import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidFailure, requireUser } from "@/lib/plaid/route";
import { syncItem, type SyncResult } from "@/lib/plaid/sync";
import type { PlaidItem } from "@/types";

/** Sync the user's bank connections now (all of them, or one by id). */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { plaid_item_id: itemId } = (await request.json().catch(() => ({}))) as {
    plaid_item_id?: string;
  };

  const admin = createAdminClient();
  let query = admin.from("plaid_items").select("*").eq("user_id", auth.user.id);
  if (itemId) query = query.eq("id", itemId);
  const { data: items, error } = await query;
  if (error) return plaidFailure(error);

  const total: SyncResult = { added: 0, updated: 0, removed: 0, historyReady: true };
  const failures: string[] = [];
  for (const item of (items ?? []) as PlaidItem[]) {
    try {
      const r = await syncItem(admin, item);
      total.added += r.added;
      total.updated += r.updated;
      total.removed += r.removed;
      total.historyReady &&= r.historyReady;
    } catch (err) {
      plaidFailure(err);
      failures.push(item.institution_name);
    }
  }
  return NextResponse.json({ ...total, failures });
}
