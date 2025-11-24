-- Fix: Add missing current_period_start and current_period_end columns
-- These are aliases/duplicates for compatibility

-- Add current_period_end if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Add current_period_start if not exists
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

-- Copy existing values
UPDATE subscriptions 
SET 
  current_period_end = period_end,
  current_period_start = period_start
WHERE current_period_end IS NULL OR current_period_start IS NULL;

-- Verify the fix
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN ('period_start', 'period_end', 'current_period_start', 'current_period_end')
ORDER BY column_name;

