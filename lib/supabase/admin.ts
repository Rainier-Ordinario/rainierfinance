import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server routes only: it bypasses Row-Level
 * Security, so every query must scope rows to a user itself. Never import
 * this from client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
