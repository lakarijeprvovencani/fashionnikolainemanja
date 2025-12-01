-- ===============================================
-- BRAND MEMORY MAP - BRAND PROFILES TABLE
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
    brand_voice TEXT, -- e.g., "Professional, Elegant, Modern"
    tone_keywords TEXT[], -- Array of keywords like ["elegant", "modern", "sustainable"]
    
    -- Target Audience (stored as JSONB for flexibility)
    target_audience JSONB DEFAULT '{}'::jsonb, -- {age_range: "25-40", gender: "women", interests: [...]}
    
    -- Product Information
    product_info JSONB DEFAULT '{}'::jsonb, -- {types: [...], price_range: "...", usp: "..."}
    
    -- Marketing Preferences
    marketing_preferences JSONB DEFAULT '{}'::jsonb, -- {hashtags: [...], ctas: [...], colors: [...]}
    
    -- Metadata
    is_active BOOLEAN DEFAULT false,
    completion_percentage INTEGER DEFAULT 0, -- 0-100
    usage_count INTEGER DEFAULT 0, -- How many times this profile was used in AI generation
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active profile per user
    CONSTRAINT unique_active_profile UNIQUE NULLS NOT DISTINCT (user_id, is_active) WHERE is_active = true
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
-- Users can only see their own brand profiles
CREATE POLICY "Users can view their own brand profiles"
    ON brand_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own brand profiles
CREATE POLICY "Users can insert their own brand profiles"
    ON brand_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own brand profiles
CREATE POLICY "Users can update their own brand profiles"
    ON brand_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own brand profiles
CREATE POLICY "Users can delete their own brand profiles"
    ON brand_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Function to ensure only one active profile per user
CREATE OR REPLACE FUNCTION ensure_single_active_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a profile to active, deactivate all others for this user
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


