-- Safe migration: Only creates what doesn't exist
-- Use this if you already have the table and want to keep existing data

-- Create table only if it doesn't exist (without foreign key in CREATE)
CREATE TABLE IF NOT EXISTS user_clothing_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_image_url TEXT NOT NULL,
  processed_image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Add foreign key constraint only if it doesn't exist (using ALTER TABLE IF NOT EXISTS equivalent)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for constraints directly, so we use a workaround
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_clothing_library_user_id_fkey'
  ) THEN
    ALTER TABLE user_clothing_library 
    ADD CONSTRAINT user_clothing_library_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_user_id ON user_clothing_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_uploaded_at ON user_clothing_library(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_last_used ON user_clothing_library(user_id, last_used_at DESC);

-- Enable Row Level Security
ALTER TABLE user_clothing_library ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can insert their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can delete their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can update their own clothing library" ON user_clothing_library;

-- Create RLS Policies
CREATE POLICY "Users can view their own clothing library"
  ON user_clothing_library
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clothing library"
  ON user_clothing_library
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clothing library"
  ON user_clothing_library
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clothing library"
  ON user_clothing_library
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_clothing_library TO authenticated;
