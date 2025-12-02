-- Create ai_generated_content table
-- This table stores all AI-generated content (models, captions, images, videos) with autosave functionality
-- Content is automatically deleted after 30 days to manage database load

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS ai_generated_content CASCADE;

CREATE TABLE ai_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'model',
    'dressed_model',
    'caption_instagram',
    'caption_webshop',
    'caption_facebook',
    'caption_email',
    'generated_image',
    'generated_video',
    'edited_image'
  )),
  
  -- Content data
  title TEXT, -- User-friendly title/name
  image_url TEXT, -- URL to generated image
  video_url TEXT, -- URL to generated video
  content_data JSONB DEFAULT '{}', -- Flexible storage for any content-specific data
  
  -- Metadata
  prompt TEXT, -- Original prompt used for generation
  scene_prompt TEXT, -- Scene description (for dressed models)
  model_id UUID REFERENCES fashion_models(id) ON DELETE SET NULL, -- Reference to model if applicable
  captions JSONB, -- Captions data (for caption types)
  
  -- Generation settings
  generation_settings JSONB DEFAULT '{}', -- Settings used for generation (model params, options, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'), -- Auto-delete after 30 days
  
  -- User preferences
  is_favorite BOOLEAN DEFAULT FALSE, -- User can mark favorites to keep longer
  tags TEXT[] DEFAULT '{}', -- User-defined tags for organization
  notes TEXT -- User notes about the content
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_content_user_id ON ai_generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_created_at ON ai_generated_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_content_type ON ai_generated_content(content_type);
CREATE INDEX IF NOT EXISTS idx_ai_content_expires_at ON ai_generated_content(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_content_user_created ON ai_generated_content(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_user_type ON ai_generated_content(user_id, content_type);
CREATE INDEX IF NOT EXISTS idx_ai_content_favorite ON ai_generated_content(user_id, is_favorite) WHERE is_favorite = TRUE;

-- Enable Row Level Security
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can insert their own AI content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can update their own AI content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can delete their own AI content" ON ai_generated_content;

-- Users can only see their own content
CREATE POLICY "Users can view their own AI content"
  ON ai_generated_content
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own content
CREATE POLICY "Users can insert their own AI content"
  ON ai_generated_content
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own content
CREATE POLICY "Users can update their own AI content"
  ON ai_generated_content
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own content
CREATE POLICY "Users can delete their own AI content"
  ON ai_generated_content
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_ai_content_updated_at
  BEFORE UPDATE ON ai_generated_content
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_content_updated_at();

-- Function to automatically clean up expired content (older than expires_at)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_content()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired content (but keep favorites for 90 days instead of 30)
  DELETE FROM ai_generated_content
  WHERE (
    (expires_at < NOW() AND is_favorite = FALSE) OR
    (expires_at < NOW() - INTERVAL '60 days' AND is_favorite = TRUE)
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to extend expiration for favorites
CREATE OR REPLACE FUNCTION extend_favorite_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- If marked as favorite, extend expiration to 90 days
  IF NEW.is_favorite = TRUE AND OLD.is_favorite = FALSE THEN
    NEW.expires_at = NOW() + INTERVAL '90 days';
  -- If unmarked as favorite, set back to 30 days from now
  ELSIF NEW.is_favorite = FALSE AND OLD.is_favorite = TRUE THEN
    NEW.expires_at = NOW() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to extend expiration when favorited
CREATE TRIGGER extend_favorite_expiration_trigger
  BEFORE UPDATE ON ai_generated_content
  FOR EACH ROW
  WHEN (NEW.is_favorite IS DISTINCT FROM OLD.is_favorite)
  EXECUTE FUNCTION extend_favorite_expiration();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_generated_content TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_ai_content TO authenticated;

-- Optional: Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Uncomment if you have pg_cron installed:
-- SELECT cron.schedule(
--   'cleanup-expired-ai-content',
--   '0 3 * * *', -- Run daily at 3 AM
--   $$SELECT cleanup_expired_ai_content()$$
-- );

-- Add comment to table
COMMENT ON TABLE ai_generated_content IS 'Stores all AI-generated content with autosave functionality. Content expires after 30 days (90 days for favorites) to manage database load.';


