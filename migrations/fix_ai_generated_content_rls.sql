-- =====================================================
-- FIX RLS POLICIES FOR ai_generated_content TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, enable RLS on the table if not already enabled
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can view their own content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can update their own content" ON ai_generated_content;
DROP POLICY IF EXISTS "Users can delete their own content" ON ai_generated_content;

-- Create policy for INSERT
CREATE POLICY "Users can insert their own content" ON ai_generated_content
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for SELECT
CREATE POLICY "Users can view their own content" ON ai_generated_content
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Create policy for UPDATE
CREATE POLICY "Users can update their own content" ON ai_generated_content
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Create policy for DELETE
CREATE POLICY "Users can delete their own content" ON ai_generated_content
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Verify the table exists and show its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ai_generated_content'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ai_generated_content';


