import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient, plaidErrorCode } from "@/lib/plaid/client";
import { plaidFailure, requireUser } from "@/lib/plaid/route";
import { accessTokenFor } from "@/lib/plaid/sync";
import type { PlaidItem } from "@/types";

/**
 * Disconnect a bank: revoke access at Plaid and forget the token. The
 * accounts and their transactions stay; they just stop syncing.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("plaid_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const accessToken = await accessTokenFor(admin, item as PlaidItem);
    await plaidClient().itemRemove({ access_token: accessToken });
  } catch (err) {
    // Already gone at Plaid: carry on and clean up here.
    if (plaidErrorCode(err) !== "ITEM_NOT_FOUND") return plaidFailure(err);
  }

  // Unlink the accounts so reconnecting later matches them again by last 4
  // digits and picks up after the last synced day.
  const { error: unlinkError } = await admin
    .from("accounts")
    .update({ plaid_item_id: null, plaid_account_id: null, plaid_sync_from: null })
    .eq("user_id", auth.user.id)
    .eq("plaid_item_id", id);
  if (unlinkError) return plaidFailure(unlinkError);
  const { error } = await admin.from("plaid_items").delete().eq("id", id);
  if (error) return plaidFailure(error);
  return NextResponse.json({ ok: true });
}
