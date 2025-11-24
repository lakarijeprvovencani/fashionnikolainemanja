-- ================================================
-- COMPLETE DATABASE FIX
-- This script fixes all database issues for user registration
-- ================================================

-- Step 1: Add missing columns to subscriptions table
-- ================================================
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start timestamptz DEFAULT now();

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT (now() + interval '1 month');

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_limit integer DEFAULT 0;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;

-- Step 2: Update existing data
-- ================================================
UPDATE subscriptions 
SET 
  current_period_start = COALESCE(current_period_start, period_start, now()),
  current_period_end = COALESCE(current_period_end, period_end, now() + interval '1 month'),
  tokens_limit = COALESCE(tokens_limit, 0),
  tokens_used = COALESCE(tokens_used, 0);

-- Step 3: Fix the initialize_user_tokens function
-- ================================================
CREATE OR REPLACE FUNCTION initialize_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free subscription with all required columns
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
  );
  
  -- Initialize user_tokens if table exists
  BEGIN
    INSERT INTO user_tokens (user_id, tokens_remaining, tokens_limit, tokens_used)
    VALUES (NEW.id, 0, 0, 0);
  EXCEPTION
    WHEN undefined_table THEN
      -- user_tokens table doesn't exist, skip
      NULL;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in initialize_user_tokens: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
-- ================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION initialize_user_tokens();

-- Step 5: Create token_transactions table if it doesn't exist
-- ================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL, -- 'deduct', 'grant', 'reset'
  reason text,
  balance_after integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on token_transactions
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for token_transactions
DROP POLICY IF EXISTS "Users can view own token transactions" ON token_transactions;
CREATE POLICY "Users can view own token transactions"
  ON token_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own token transactions" ON token_transactions;
CREATE POLICY "Users can insert own token transactions"
  ON token_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);

-- Step 6: Verify setup
-- ================================================
SELECT 
  'subscriptions columns' as check_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN (
    'period_start', 
    'period_end', 
    'current_period_start', 
    'current_period_end',
    'tokens_limit',
    'tokens_used'
  )
ORDER BY column_name;

-- ================================================
-- SETUP COMPLETE!
-- ================================================

