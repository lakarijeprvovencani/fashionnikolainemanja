-- ===============================================
-- BRAND MEMORY MAP - BRAND PROFILES TABLE
-- Copy and paste this entire file into Supabase SQL Editor
-- ===============================================

-- Create brand_profiles table
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Basic Information
    brand_name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    
    -- Brand Voice & Tone
    brand_voice TEXT,
    tone_keywords TEXT[],
    
    -- Target Audience (stored as JSONB for flexibility)
    target_audience JSONB DEFAULT '{}'::jsonb,
    
    -- Product Information
    product_info JSONB DEFAULT '{}'::jsonb,
    
    -- Marketing Preferences
    marketing_preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    is_active BOOLEAN DEFAULT false,
    completion_percentage INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id ON brand_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_active ON brand_profiles(user_id, is_active) WHERE is_active = true;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_brand_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER brand_profiles_updated_at
    BEFORE UPDATE ON brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_brand_profiles_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own brand profiles"
    ON brand_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brand profiles"
    ON brand_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand profiles"
    ON brand_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brand profiles"
    ON brand_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Function to ensure only one active profile per user
CREATE OR REPLACE FUNCTION ensure_single_active_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE brand_profiles
        SET is_active = false
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single active profile
CREATE TRIGGER ensure_single_active_brand_profile
    BEFORE INSERT OR UPDATE ON brand_profiles
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE FUNCTION ensure_single_active_profile();


