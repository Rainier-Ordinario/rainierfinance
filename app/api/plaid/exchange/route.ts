import { NextRequest, NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid/client";
import { encryptToken } from "@/lib/plaid/crypto";
import { plaidFailure, requireUser } from "@/lib/plaid/route";
import { linkAccounts } from "@/lib/plaid/sync";
import type { PlaidItem } from "@/types";

/**
 * Finish linking a bank: swap Link's one-time public token for a permanent
 * access token, store it encrypted, and create the bank's accounts. The
 * browser runs the first sync right after.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { public_token: publicToken } = (await request
    .json()
    .catch(() => ({}))) as { public_token?: string };
  if (!publicToken) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const plaid = plaidClient();
  const admin = createAdminClient();
  try {
    const { data: exchange } = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.access_token;

    const { data: itemData } = await plaid.itemGet({ access_token: accessToken });
    let institutionName = itemData.item.institution_name ?? null;
    const institutionId = itemData.item.institution_id ?? null;
    if (!institutionName && institutionId) {
      const { data: inst } = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Ca],
      });
      institutionName = inst.institution.name;
    }

    const { data: item, error } = await admin
      .from("plaid_items")
      .insert({
        user_id: auth.user.id,
        item_id: exchange.item_id,
        institution_id: institutionId,
        institution_name: institutionName ?? "Bank",
      })
      .select()
      .single();
    if (error) throw error;

    const { error: tokenError } = await admin.from("plaid_item_tokens").insert({
      plaid_item_id: item.id,
      access_token_encrypted: encryptToken(accessToken),
    });
    if (tokenError) {
      await admin.from("plaid_items").delete().eq("id", item.id);
      throw tokenError;
    }

    const { data: accounts } = await plaid.accountsGet({ access_token: accessToken });
    await linkAccounts(admin, item as PlaidItem, accounts.accounts);

    return NextResponse.json({ item });
  } catch (err) {
    return plaidFailure(err);
  }
}
