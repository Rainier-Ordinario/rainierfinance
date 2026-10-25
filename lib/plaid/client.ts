import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

/** Whether the server has what bank sync needs; routes answer 503 otherwise. */
export function plaidConfigured(): boolean {
  return Boolean(
    process.env.PLAID_CLIENT_ID &&
      process.env.PLAID_SECRET &&
      process.env.PLAID_TOKEN_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let client: PlaidApi | null = null;

export function plaidClient(): PlaidApi {
  if (client) return client;
  const env = process.env.PLAID_ENV === "production" ? "production" : "sandbox";
  client = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
          "PLAID-SECRET": process.env.PLAID_SECRET!,
        },
      },
    })
  );
  return client;
}

/** Plaid's error_code from a failed SDK call (axios error), if any. */
export function plaidErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error_code?: string } } })
    ?.response?.data;
  return data?.error_code ?? null;
}

/** A readable message for a failed Plaid call. */
export function plaidErrorMessage(err: unknown): string {
  const data = (
    err as {
      response?: {
        data?: { display_message?: string | null; error_message?: string };
      };
    }
  )?.response?.data;
  return (
    data?.display_message ??
    data?.error_message ??
    (err instanceof Error ? err.message : "Bank sync failed")
  );
}
