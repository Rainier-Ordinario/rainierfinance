import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  plaidConfigured,
  plaidErrorCode,
  plaidErrorMessage,
} from "@/lib/plaid/client";

// Shared plumbing for the /api/plaid routes.

/**
 * The signed-in user, or a response to return instead: 401 when signed
 * out, 503 when the server has no Plaid keys yet.
 */
export async function requireUser() {
  if (!plaidConfigured()) {
    return {
      response: NextResponse.json(
        {
          error:
            "Bank sync isn't set up yet — add PLAID_CLIENT_ID, PLAID_SECRET and PLAID_TOKEN_KEY to .env.local.",
        },
        { status: 503 }
      ),
    } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { user } as const;
}

export function plaidFailure(err: unknown) {
  // Not the raw error: an axios error carries the request headers, which
  // hold the Plaid secret.
  console.error("[plaid]", plaidErrorCode(err) ?? "", plaidErrorMessage(err));
  return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 });
}
