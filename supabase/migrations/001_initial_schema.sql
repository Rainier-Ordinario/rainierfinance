-- RainierFinance initial schema
-- Apply with: supabase db push (linked project) or paste into the SQL editor.

-- ============================================================
-- Tables
-- ============================================================

-- Users profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'CAD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts (bank accounts, credit cards, investment accounts)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "RBC ION+ Visa"
  type TEXT NOT NULL CHECK (type IN ('chequing', 'savings', 'credit_card', 'tfsa', 'fhsa', 'crypto', 'investment')),
  institution TEXT NOT NULL, -- e.g. "RBC", "Wealthsimple", "Coinbase"
  balance DECIMAL(12,2) DEFAULT 0,
  credit_limit DECIMAL(12,2), -- for credit cards only
  currency TEXT DEFAULT 'CAD',
  color TEXT DEFAULT '#6366F1',
  account_number_last4 TEXT, -- for CSV import auto-matching
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL, -- negative for expenses, positive for income
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  is_recurring BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT CHECK (type IN ('expense', 'income', 'both')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'CAD',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly', 'weekly')),
  next_billing_date DATE NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '💰',
  total_amount DECIMAL(12,2) NOT NULL,
  spent_amount DECIMAL(12,2) DEFAULT 0,
  period TEXT CHECK (period IN ('monthly', 'weekly', 'yearly', 'custom')),
  start_date DATE,
  end_date DATE,
  category TEXT,
  color TEXT DEFAULT '#6366F1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Investments (stocks + ETFs from Wealthsimple)
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(12,6) NOT NULL,
  average_cost DECIMAL(12,4) NOT NULL,
  current_price DECIMAL(12,4),
  market_value DECIMAL(12,2),
  unrealized_gain DECIMAL(12,2),
  unrealized_gain_pct DECIMAL(8,4),
  account_type TEXT CHECK (account_type IN ('TFSA', 'FHSA', 'RRSP', 'Non-Registered')),
  asset_type TEXT CHECK (asset_type IN ('ETF', 'EQUITY', 'CRYPTO')),
  currency TEXT DEFAULT 'CAD',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crypto holdings (from Coinbase)
CREATE TABLE crypto_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  average_cost_cad DECIMAL(12,4) NOT NULL,
  current_price_cad DECIMAL(12,4),
  market_value_cad DECIMAL(12,2),
  unrealized_gain_cad DECIMAL(12,2),
  unrealized_gain_pct DECIMAL(8,4),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat history
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit card payment reminders
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  statement_close_date INTEGER, -- day of month (e.g. 15)
  due_date INTEGER, -- day of month (e.g. 25)
  autopay_enabled BOOLEAN DEFAULT false,
  autopay_type TEXT CHECK (autopay_type IN ('minimum', 'full_balance', 'fixed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly net worth snapshots (manual logging; also powers historical
-- utilization since there is no bank API)
CREATE TABLE net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  account_balances JSONB DEFAULT '{}'::jsonb, -- { account_id: balance }
  total_assets DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_liabilities DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_worth DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, snapshot_date)
);

-- Per-user settings: encrypted Coinbase credentials, Avion points,
-- dry powder designation
CREATE TABLE user_settings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  coinbase_api_key_encrypted TEXT,
  coinbase_api_secret_encrypted TEXT,
  coinbase_last_synced_at TIMESTAMPTZ,
  avion_points_balance INTEGER DEFAULT 0,
  dry_powder_amount DECIMAL(12,2) DEFAULT 0,
  dry_powder_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_category ON transactions (user_id, category);
CREATE INDEX idx_accounts_user ON accounts (user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, next_billing_date);
CREATE INDEX idx_investments_user ON investments (user_id);
CREATE INDEX idx_crypto_user ON crypto_holdings (user_id);
CREATE INDEX idx_chat_user_created ON chat_messages (user_id, created_at);
CREATE INDEX idx_snapshots_user_date ON net_worth_snapshots (user_id, snapshot_date DESC);
CREATE INDEX idx_budgets_user ON budgets (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- profiles keys on id, not user_id
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- All other tables key on user_id
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'transactions', 'categories', 'subscriptions', 'budgets',
    'investments', 'crypto_holdings', 'chat_messages', 'payment_reminders',
    'net_worth_snapshots', 'user_settings'
  ]
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

-- ============================================================
-- Triggers
-- ============================================================

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile + settings + default categories on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  INSERT INTO user_settings (user_id) VALUES (NEW.id);

  INSERT INTO categories (user_id, name, icon, color, type, is_default) VALUES
    (NEW.id, 'Groceries',     'shopping-cart', '#10B981', 'expense', true),
    (NEW.id, 'Dining',        'utensils',      '#F59E0B', 'expense', true),
    (NEW.id, 'Food Delivery', 'bike',          '#F97316', 'expense', true),
    (NEW.id, 'Gas',           'fuel',          '#EF4444', 'expense', true),
    (NEW.id, 'Transit',       'train-front',   '#06B6D4', 'expense', true),
    (NEW.id, 'Rideshare',     'car',           '#8B5CF6', 'expense', true),
    (NEW.id, 'Streaming',     'play',          '#EC4899', 'expense', true),
    (NEW.id, 'Subscriptions', 'repeat',        '#6366F1', 'expense', true),
    (NEW.id, 'Shopping',      'shopping-bag',  '#F472B6', 'expense', true),
    (NEW.id, 'Bills',         'receipt',       '#64748B', 'expense', true),
    (NEW.id, 'Health',        'heart-pulse',   '#14B8A6', 'expense', true),
    (NEW.id, 'Education',     'graduation-cap','#3B82F6', 'expense', true),
    (NEW.id, 'Entertainment', 'gamepad-2',     '#A855F7', 'expense', true),
    (NEW.id, 'Crypto',        'bitcoin',       '#F7931A', 'both',    true),
    (NEW.id, 'Investments',   'trending-up',   '#22C55E', 'both',    true),
    (NEW.id, 'Income',        'banknote',      '#10B981', 'income',  true),
    (NEW.id, 'Transfer',      'arrow-left-right', '#94A3B8', 'both', true),
    (NEW.id, 'Other',         'circle-ellipsis', '#9CA3AF', 'both',  true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
