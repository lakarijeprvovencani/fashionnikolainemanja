-- ================================================
-- FINAL FIX - EVERYTHING IN ONE SCRIPT
-- Run this in Supabase SQL Editor
-- ================================================

-- STEP 1: Fix subscriptions table columns
-- ================================================
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start timestamptz DEFAULT now();

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT (now() + interval '1 month');

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_limit integer DEFAULT 0;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;

UPDATE subscriptions 
SET 
  current_period_start = COALESCE(current_period_start, period_start, now()),
  current_period_end = COALESCE(current_period_end, period_end, now() + interval '1 month'),
  tokens_limit = COALESCE(tokens_limit, 0),
  tokens_used = COALESCE(tokens_used, 0);

-- STEP 2: Create token_transactions table
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

-- STEP 3: Fix fashion_models status constraint
-- ================================================
ALTER TABLE fashion_models DROP CONSTRAINT IF EXISTS fashion_models_status_check;

ALTER TABLE fashion_models
ADD CONSTRAINT fashion_models_status_check 
CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'active', 'deleted'));

-- STEP 4: Create storage bucket
-- ================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'model-images', 
  'model-images', 
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop old storage policies
DROP POLICY IF EXISTS "Authenticated users can upload model images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own model images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own model images" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can upload model images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'model-images' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view model images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'model-images');

CREATE POLICY "Users can delete their own model images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'model-images' AND 
  auth.role() = 'authenticated' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own model images" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'model-images' AND 
  auth.role() = 'authenticated' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- STEP 5: Create unified trigger
-- ================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user_unified()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 2. Create subscription
  INSERT INTO subscriptions (
    user_id, plan_type, status, 
    period_start, period_end,
    current_period_start, current_period_end,
    tokens_limit, tokens_used
  )
  VALUES (
    NEW.id, 'free', 'active',
    now(), now() + interval '1 month',
    now(), now() + interval '1 month',
    0, 0
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 3. Create user_tokens
  BEGIN
    INSERT INTO user_tokens (user_id, tokens_remaining, tokens_limit, tokens_used)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN undefined_table THEN NULL;
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

-- STEP 6: Backfill existing users
-- ================================================
INSERT INTO public.profiles (id, email, full_name)
SELECT 
  u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '') as full_name
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (
  user_id, plan_type, status, 
  period_start, period_end,
  current_period_start, current_period_end,
  tokens_limit, tokens_used
)
SELECT 
  u.id, 'free', 'active',
  now(), now() + interval '1 month',
  now(), now() + interval '1 month',
  0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- STEP 7: Verification
-- ================================================
SELECT 
  'Database Check' as category,
  'Auth Users' as item,
  COUNT(*)::text as count
FROM auth.users
UNION ALL
SELECT 'Database Check', 'Profiles', COUNT(*)::text FROM profiles
UNION ALL
SELECT 'Database Check', 'Subscriptions', COUNT(*)::text FROM subscriptions
UNION ALL
SELECT 'Database Check', 'Fashion Models', COUNT(*)::text FROM fashion_models
UNION ALL
SELECT 
  'Storage Check',
  'model-images bucket',
  CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'model-images') 
    THEN 'EXISTS ✓' 
    ELSE 'MISSING ✗' 
  END
FROM (SELECT 1) as dummy;

-- ================================================
-- ✅ ALL FIXES COMPLETE!
-- Now refresh your app and try:
-- 1. Create a model
-- 2. Save to studio
-- 3. Check if it appears in "My Studio"
-- ================================================


