-- ================================================
-- MASTER FIX - RUN THIS TO FIX EVERYTHING
-- Copy and paste this entire file into Supabase SQL Editor
-- ================================================

-- STEP 1: Add missing columns to subscriptions
-- ================================================
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start timestamptz DEFAULT now();

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT (now() + interval '1 month');

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_limit integer DEFAULT 0;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;

-- Update existing data
UPDATE subscriptions 
SET 
  current_period_start = COALESCE(current_period_start, period_start, now()),
  current_period_end = COALESCE(current_period_end, period_end, now() + interval '1 month'),
  tokens_limit = COALESCE(tokens_limit, 0),
  tokens_used = COALESCE(tokens_used, 0);

-- STEP 2: Create token_transactions table if missing
-- ================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL,
  reason text,
  balance_after integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own token transactions" ON token_transactions;
CREATE POLICY "Users can view own token transactions"
  ON token_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own token transactions" ON token_transactions;
CREATE POLICY "Users can insert own token transactions"
  ON token_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);

-- STEP 3: Fix fashion_models status check constraint
-- ================================================
-- First drop the old constraint if it exists
ALTER TABLE fashion_models DROP CONSTRAINT IF EXISTS fashion_models_status_check;

-- Add new constraint that includes 'active' and 'deleted'
ALTER TABLE fashion_models
ADD CONSTRAINT fashion_models_status_check 
CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'active', 'deleted'));

-- STEP 4: Create unified trigger
-- ================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user_unified()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create profile first
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 2. Create free subscription
  INSERT INTO subscriptions (
    user_id, 
    plan_type, 
    status, 
    period_start, 
    period_end,
    current_period_start,
    current_period_end,
    tokens_limit,
    tokens_used
  )
  VALUES (
    NEW.id, 
    'free', 
    'active',
    now(),
    now() + interval '1 month',
    now(),
    now() + interval '1 month',
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 3. Initialize user_tokens if table exists
  BEGIN
    INSERT INTO user_tokens (user_id, tokens_remaining, tokens_limit, tokens_used)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user_unified: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_unified();

-- STEP 5: Fix existing users (backfill)
-- ================================================

-- Ensure all users have profiles
INSERT INTO public.profiles (id, email, full_name)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '') as full_name
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Ensure all users have subscriptions
INSERT INTO subscriptions (
  user_id, 
  plan_type, 
  status, 
  period_start, 
  period_end,
  current_period_start,
  current_period_end,
  tokens_limit,
  tokens_used
)
SELECT 
  u.id,
  'free',
  'active',
  now(),
  now() + interval '1 month',
  now(),
  now() + interval '1 month',
  0,
  0
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- STEP 6: Verification
-- ================================================
SELECT 
  'Check' as type,
  'Total Auth Users' as name,
  COUNT(*)::text as count
FROM auth.users
UNION ALL
SELECT 
  'Check',
  'Total Profiles',
  COUNT(*)::text
FROM profiles
UNION ALL
SELECT 
  'Check',
  'Total Subscriptions',
  COUNT(*)::text
FROM subscriptions
UNION ALL
SELECT 
  'Check',
  'Total Fashion Models',
  COUNT(*)::text
FROM fashion_models;

-- ================================================
-- ALL FIXES COMPLETE! 
-- Try creating a new user or model now.
-- ================================================


