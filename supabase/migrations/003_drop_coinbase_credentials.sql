-- The Coinbase API-sync feature was never built: nothing writes these
-- columns, and since user_settings is client-readable under RLS, any
-- credentials stored here would be exposed to the browser. Drop them until
-- a server-side sync actually exists (holdings come in via CSV import).
ALTER TABLE user_settings
  DROP COLUMN IF EXISTS coinbase_api_key_encrypted,
  DROP COLUMN IF EXISTS coinbase_api_secret_encrypted,
  DROP COLUMN IF EXISTS coinbase_last_synced_at;
