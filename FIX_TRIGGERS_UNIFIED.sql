-- ================================================
-- UNIFIED USER CREATION TRIGGER
-- This fixes the conflict between multiple triggers
-- ================================================

-- Step 1: Drop existing triggers to avoid conflicts
-- ================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create unified function that handles everything
-- ================================================
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
  
  -- 2. Create free subscription with all required columns
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
    WHEN undefined_table THEN
      -- user_tokens table doesn't exist, skip
      NULL;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user_unified: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the unified trigger
-- ================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_unified();

-- Step 4: Verify that profiles exist for existing users
-- ================================================
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

-- Step 5: Verify subscriptions exist for existing users
-- ================================================
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

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check profiles
SELECT 
  'Total Users' as check_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Total Profiles',
  COUNT(*)
FROM profiles
UNION ALL
SELECT 
  'Total Subscriptions',
  COUNT(*)
FROM subscriptions;

-- ================================================
-- SETUP COMPLETE!
-- ================================================


