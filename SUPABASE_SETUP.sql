-- ================================================
-- FASHION MODEL CREATOR - SUPABASE DATABASE SETUP
-- Subscription & Token System
-- ================================================

-- 1. SUBSCRIPTION PLANS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  interval text NOT NULL, -- 'month', '6months', 'year'
  tokens_per_period integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, description, price, interval, tokens_per_period, is_active)
VALUES 
  ('free', 'Free Plan', 'No tokens included - upgrade to start creating', 0.00, 'month', 0, true),
  ('monthly', 'Monthly Plan', 'Perfect for regular creators', 9.99, 'month', 100000, true),
  ('sixMonth', '6-Month Plan', 'Save $10 with our 6-month plan', 49.99, '6months', 100000, true),
  ('annual', 'Annual Plan', 'Best value - save $30 per year!', 89.99, 'year', 100000, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  tokens_per_period = EXCLUDED.tokens_per_period,
  updated_at = now();

-- 2. USER SUBSCRIPTIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'past_due'
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  
  -- Lemon Squeezy fields (for production)
  lemon_subscription_id text,
  lemon_customer_id text,
  lemon_product_id text,
  lemon_variant_id text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lemon_id ON subscriptions(lemon_subscription_id);

-- 3. USER TOKENS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_remaining integer NOT NULL DEFAULT 0,
  tokens_limit integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id),
  CHECK (tokens_remaining >= 0),
  CHECK (tokens_used >= 0)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);

-- 4. TOKEN USAGE LOG (Optional but recommended for analytics)
-- ================================================
CREATE TABLE IF NOT EXISTS token_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL,
  action_type text NOT NULL, -- 'create_model', 'dress_model', etc.
  description text,
  created_at timestamptz DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage_log(created_at);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;

-- Subscription Plans - Everyone can read (public data)
CREATE POLICY "Anyone can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Subscriptions - Users can only see their own
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- User Tokens - Users can only see/update their own
CREATE POLICY "Users can view own tokens"
  ON user_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON user_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON user_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Token Usage Log - Users can view and insert their own logs
CREATE POLICY "Users can view own token usage log"
  ON token_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own token usage log"
  ON token_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. FUNCTIONS
-- ================================================

-- Function to initialize tokens for new users
CREATE OR REPLACE FUNCTION initialize_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free subscription
  INSERT INTO subscriptions (user_id, plan_type, status, period_start, period_end)
  VALUES (
    NEW.id, 
    'free', 
    'active',
    now(),
    now() + interval '1 month'
  );
  
  -- Initialize with 0 tokens (free plan)
  INSERT INTO user_tokens (user_id, tokens_remaining, tokens_limit, tokens_used)
  VALUES (NEW.id, 0, 0, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add tokens (for purchases or upgrades)
CREATE OR REPLACE FUNCTION add_tokens(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE user_tokens
  SET 
    tokens_remaining = tokens_remaining + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly tokens
CREATE OR REPLACE FUNCTION reset_monthly_tokens(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_plan_tokens integer;
BEGIN
  -- Get token limit from user's current plan
  SELECT sp.tokens_per_period INTO v_plan_tokens
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_type = sp.id
  WHERE s.user_id = p_user_id AND s.status = 'active';
  
  -- Reset tokens
  UPDATE user_tokens
  SET 
    tokens_remaining = v_plan_tokens,
    tokens_limit = v_plan_tokens,
    tokens_used = 0,
    last_reset_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TRIGGERS
-- ================================================

-- Trigger to initialize tokens when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_tokens();

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tokens_updated_at ON user_tokens;
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SETUP COMPLETE!
-- ================================================

-- Verify tables were created
SELECT 
  'subscription_plans' as table_name, 
  count(*) as row_count 
FROM subscription_plans
UNION ALL
SELECT 'subscriptions', count(*) FROM subscriptions
UNION ALL
SELECT 'user_tokens', count(*) FROM user_tokens
UNION ALL
SELECT 'token_usage_log', count(*) FROM token_usage_log;

-- Show all plans
SELECT * FROM subscription_plans ORDER BY price;

