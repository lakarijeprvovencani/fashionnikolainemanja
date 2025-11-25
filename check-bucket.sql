-- SQL Queries to check Supabase Storage Bucket Configuration
-- Run these in Supabase Dashboard > SQL Editor

-- 1. Check if 'dressed-models' bucket exists
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE name = 'dressed-models';

-- 2. Check all buckets (to see what buckets exist)
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY name;

-- 3. Check RLS policies for storage.objects table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
ORDER BY policyname;

-- 4. Check if bucket is public (should return true for public buckets)
SELECT 
  name,
  public,
  CASE 
    WHEN public THEN '✅ Bucket is PUBLIC - URLs will work'
    ELSE '❌ Bucket is PRIVATE - URLs might not work without authentication'
  END as status
FROM storage.buckets 
WHERE name = 'dressed-models';

-- 5. Check files in the bucket (if you have access)
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'dressed-models'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if there are any policies that allow INSERT (upload) for authenticated users
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND cmd = 'INSERT'
  AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles));

-- 7. Check if there are any policies that allow SELECT (read) for public
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND cmd = 'SELECT'
  AND ('public' = ANY(roles) OR 'authenticated' = ANY(roles));

-- 8. Create/Update policy to allow authenticated users to upload (if needed)
-- WARNING: Only run this if you understand what it does!
-- This creates a policy that allows authenticated users to upload to dressed-models bucket
/*
CREATE POLICY "Allow authenticated users to upload to dressed-models"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dressed-models');
*/

-- 9. Create/Update policy to allow public read access (if bucket is public)
-- WARNING: Only run this if you understand what it does!
-- This creates a policy that allows public read access to dressed-models bucket
/*
CREATE POLICY "Allow public read access to dressed-models"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dressed-models');
*/

-- 10. CREATE THE BUCKET IF IT DOESN'T EXIST
-- Run this to create the 'dressed-models' bucket
-- This will create a PUBLIC bucket that allows image URLs to work
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dressed-models',
  'dressed-models',
  true,  -- Make it public so URLs work
  52428800,  -- 50MB file size limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 11. Create policy to allow authenticated users to upload
-- This allows logged-in users to upload files to the bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload to dressed-models"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dressed-models');

-- 12. Create policy to allow public read access
-- This allows anyone to view/download images from the bucket (needed for public URLs)
CREATE POLICY IF NOT EXISTS "Allow public read access to dressed-models"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dressed-models');

-- 13. Create policy to allow users to delete their own files
-- This allows users to delete files they uploaded
CREATE POLICY IF NOT EXISTS "Allow users to delete their own files from dressed-models"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'dressed-models' AND auth.uid()::text = (storage.foldername(name))[1]);

