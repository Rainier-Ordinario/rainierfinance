-- Share of income the user aims to save; drives the dashboard's daily
-- "safe to spend" number.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS savings_target_pct NUMERIC(5,2) NOT NULL DEFAULT 20
  CHECK (savings_target_pct >= 0 AND savings_target_pct <= 100);
