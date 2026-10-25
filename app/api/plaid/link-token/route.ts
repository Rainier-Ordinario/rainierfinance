import { NextRequest, NextResponse } from "next/server";
import { CountryCode, Products, type LinkTokenCreateRequest } from "plaid";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid/client";
import { plaidFailure, requireUser } from "@/lib/plaid/route";
import { accessTokenFor } from "@/lib/plaid/sync";
import type { PlaidItem } from "@/types";

/**
 * A short-lived token that opens Plaid Link in the browser. With
 * `plaid_item_id`, Link opens in update mode to repair that connection
 * (the bank wants the user to log in again).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { plaid_item_id: itemId } = (await request.json().catch(() => ({}))) as {
    plaid_item_id?: string;
  };

  const req: LinkTokenCreateRequest = {
    user: { client_user_id: auth.user.id },
    client_name: "RainierFinance",
    country_codes: [CountryCode.Ca],
    language: "en",
    ...(process.env.PLAID_WEBHOOK_URL
      ? { webhook: process.env.PLAID_WEBHOOK_URL }
      : {}),
  };

  try {
    if (itemId) {
      const admin = createAdminClient();
      const { data: item } = await admin
        .from("plaid_items")
        .select("*")
        .eq("id", itemId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!item) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }
      req.access_token = await accessTokenFor(admin, item as PlaidItem);
    } else {
      req.products = [Products.Transactions];
      // Ask for the most history Plaid offers on the first sync.
      req.transactions = { days_requested: 730 };
    }
    const { data } = await plaidClient().linkTokenCreate(req);
    return NextResponse.json({ link_token: data.link_token });
  } catch (err) {
    return plaidFailure(err);
  }
}
