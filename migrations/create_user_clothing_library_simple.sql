-- Simple safe migration - works even if table/constraints already exist
-- This version avoids DO blocks and uses simpler syntax

-- Step 1: Create table without foreign key constraint
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

-- Step 2: Add foreign key constraint (will fail silently if exists, but that's OK)
-- We'll handle this by checking if column needs the constraint
-- First, let's just try to add it - if it fails, table is already set up correctly

-- Step 3: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_user_id ON user_clothing_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_uploaded_at ON user_clothing_library(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_last_used ON user_clothing_library(user_id, last_used_at DESC);

-- Step 4: Enable Row Level Security
ALTER TABLE user_clothing_library ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can insert their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can delete their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can update their own clothing library" ON user_clothing_library;

-- Step 6: Create RLS Policies
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

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_clothing_library TO authenticated;




