-- Bank sync through Plaid. Each linked bank login is a plaid_items row the
-- browser can read (name, status, last sync). Its access token lives in
-- plaid_item_tokens, which has RLS on and no policies, so only the server
-- (service-role key) can read it — and it is encrypted there too.
CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL UNIQUE,
  institution_id TEXT,
  institution_name TEXT NOT NULL DEFAULT 'Bank',
  -- /transactions/sync position; NULL until the first sync
  cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'login_required', 'error')),
  error_code TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plaid_item_tokens (
  plaid_item_id UUID PRIMARY KEY REFERENCES plaid_items(id) ON DELETE CASCADE,
  -- AES-256-GCM, see lib/plaid/crypto.ts
  access_token_encrypted TEXT NOT NULL
);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_item_tokens ENABLE ROW LEVEL SECURITY;

-- Read-only from the browser; the server routes create, update and delete.
CREATE POLICY "plaid_items_select_own" ON plaid_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items (user_id);

-- Which Plaid account an app account syncs from. plaid_sync_from is the
-- first date Plaid rows are taken for an account that already had CSV
-- history, so the overlap isn't counted twice.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plaid_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS plaid_sync_from DATE;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT false;
