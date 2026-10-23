-- Learned merchant → category rules. Keyed by the normalized merchant string
-- from merchantKey() in lib/utils/categorize.ts; applied on import and when
-- the user recategorizes a transaction.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS merchant_rules JSONB NOT NULL DEFAULT '{}';

-- How a spending category behaves: fixed bills, essential-but-variable, or
-- discretionary. NULL falls back to a name-based default in the app.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind TEXT
  CHECK (kind IN ('fixed', 'essential', 'discretionary'));
