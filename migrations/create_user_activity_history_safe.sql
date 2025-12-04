-- Safe migration: Only creates what doesn't exist
-- Use this if you already have the table and want to keep existing data

-- Create table only if it doesn't exist
CREATE TABLE IF NOT EXISTS user_activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'generate_image',
    'edit_image', 
    'generate_video',
    'create_captions',
    'create_model',
    'dress_model'
  )),
  image_url TEXT,
  video_url TEXT,
  model_id UUID REFERENCES fashion_models(id) ON DELETE SET NULL,
  prompt TEXT,
  scene_prompt TEXT,
  captions_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_activity_history_user_id ON user_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_history_created_at ON user_activity_history(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_history_activity_type ON user_activity_history(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_history_user_created ON user_activity_history(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_activity_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view their own activity history" ON user_activity_history;
DROP POLICY IF EXISTS "Users can insert their own activity history" ON user_activity_history;
DROP POLICY IF EXISTS "Users can delete their own activity history" ON user_activity_history;

-- Create RLS Policies
CREATE POLICY "Users can view their own activity history"
  ON user_activity_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity history"
  ON user_activity_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity history"
  ON user_activity_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create or replace cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_activity_history(retention_days INTEGER DEFAULT 15)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_activity_history
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON user_activity_history TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_activity_history TO authenticated;




