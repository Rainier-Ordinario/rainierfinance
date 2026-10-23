-- Savings goals. Progress comes from a linked account's balance when
-- account_id is set, otherwise from saved_amount (updated by hand).
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
  target_date DATE,
  saved_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly spending challenges: keep a category under a cap, or rack up
-- days with no discretionary spending.
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('category_cap', 'no_spend_days')),
  category TEXT,
  -- category_cap: the dollar cap; no_spend_days: the number of days
  target DECIMAL(12,2) NOT NULL CHECK (target > 0),
  month DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (kind <> 'category_cap' OR category IS NOT NULL)
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['goals', 'challenges']
  LOOP
    EXECUTE format(
      'CREATE POLICY "%1$s_select_own" ON %1$I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "%1$s_insert_own" ON %1$I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "%1$s_update_own" ON %1$I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "%1$s_delete_own" ON %1$I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges (user_id, month);

-- Split transactions: one bank row becomes several rows sharing a
-- split_group. split_original_amount keeps the bank's amount so a
-- re-imported statement still recognizes the row as already imported.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS split_group UUID,
  ADD COLUMN IF NOT EXISTS split_original_amount DECIMAL(12,2);
