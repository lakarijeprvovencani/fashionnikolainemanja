-- Create user_clothing_library table
-- Stores processed clothing images so users can reuse them without reprocessing

CREATE TABLE IF NOT EXISTS user_clothing_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_image_url TEXT NOT NULL,
  processed_image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT user_clothing_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_user_id ON user_clothing_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_uploaded_at ON user_clothing_library(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clothing_library_last_used ON user_clothing_library(user_id, last_used_at DESC);

-- Enable Row Level Security
ALTER TABLE user_clothing_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can insert their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can delete their own clothing library" ON user_clothing_library;
DROP POLICY IF EXISTS "Users can update their own clothing library" ON user_clothing_library;

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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_clothing_library TO authenticated;

