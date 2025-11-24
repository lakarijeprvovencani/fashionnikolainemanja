-- ================================================
-- COMPLETE FIX: Add all missing columns to subscriptions table
-- ================================================

-- Add current_period_start if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

-- Add current_period_end if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Add tokens_limit if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_limit integer DEFAULT 0;

-- Add tokens_used if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;

-- Copy existing values from period_start/period_end to current_period_start/current_period_end
UPDATE subscriptions 
SET 
  current_period_start = COALESCE(current_period_start, period_start),
  current_period_end = COALESCE(current_period_end, period_end),
  tokens_limit = COALESCE(tokens_limit, 0),
  tokens_used = COALESCE(tokens_used, 0)
WHERE current_period_start IS NULL 
   OR current_period_end IS NULL
   OR tokens_limit IS NULL
   OR tokens_used IS NULL;

-- Verify all columns exist
SELECT 
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


