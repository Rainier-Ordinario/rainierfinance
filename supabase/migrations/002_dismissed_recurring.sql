-- Persist which detected recurring charges the user has dismissed, keyed by
-- the normalized merchant string used by detectRecurringCharges().
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS dismissed_recurring JSONB NOT NULL DEFAULT '[]';
