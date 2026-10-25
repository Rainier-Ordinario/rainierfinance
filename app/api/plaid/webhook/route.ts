import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient, plaidConfigured } from "@/lib/plaid/client";
import { plaidFailure } from "@/lib/plaid/route";
import { syncItem } from "@/lib/plaid/sync";
import type { PlaidItem } from "@/types";

// Plaid calls this (PLAID_WEBHOOK_URL) when new transactions are ready or a
// connection breaks. It's public, so every request must carry a valid
// Plaid-Verification JWT signed over the exact body.

const keyCache = new Map<string, JWK>();

async function verify(request: NextRequest, body: string): Promise<boolean> {
  const token = request.headers.get("plaid-verification");
  if (!token) return false;
  try {
    const { kid, alg } = decodeProtectedHeader(token);
    if (alg !== "ES256" || !kid) return false;
    let jwk = keyCache.get(kid);
    if (!jwk) {
      const { data } = await plaidClient().webhookVerificationKeyGet({ key_id: kid });
      jwk = data.key as unknown as JWK;
      keyCache.set(kid, jwk);
    }
    const { payload } = await jwtVerify(token, await importJWK(jwk, "ES256"), {
      algorithms: ["ES256"],
      maxTokenAge: "5 min",
    });
    const expected = Buffer.from(String(payload.request_body_sha256 ?? ""), "utf8");
    const actual = Buffer.from(createHash("sha256").update(body).digest("hex"), "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const body = await request.text();
  if (!(await verify(request, body))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body) as {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    error?: { error_code?: string } | null;
  };
  if (!event.item_id) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("plaid_items")
    .select("*")
    .eq("item_id", event.item_id)
    .maybeSingle();
  if (!item) return NextResponse.json({ ok: true });

  const kind = `${event.webhook_type}:${event.webhook_code}`;
  try {
    switch (kind) {
      case "TRANSACTIONS:SYNC_UPDATES_AVAILABLE":
        await syncItem(admin, item as PlaidItem);
        break;
      case "ITEM:ERROR":
      case "ITEM:PENDING_EXPIRATION":
      case "ITEM:PENDING_DISCONNECT":
        await admin
          .from("plaid_items")
          .update({
            status:
              kind === "ITEM:ERROR" &&
              event.error?.error_code !== "ITEM_LOGIN_REQUIRED"
                ? "error"
                : "login_required",
            error_code: event.error?.error_code ?? event.webhook_code,
          })
          .eq("id", item.id);
        break;
      case "ITEM:LOGIN_REPAIRED":
        await admin
          .from("plaid_items")
          .update({ status: "active", error_code: null })
          .eq("id", item.id);
        break;
      case "ITEM:USER_PERMISSION_REVOKED":
      case "ITEM:USER_ACCOUNT_REVOKED":
        await admin
          .from("plaid_items")
          .update({ status: "error", error_code: event.webhook_code })
          .eq("id", item.id);
        break;
    }
  } catch (err) {
    // Plaid retries non-2xx responses, which is what a failed sync wants.
    return plaidFailure(err);
  }
  return NextResponse.json({ ok: true });
}
