-- ================================================
-- FIX STORAGE BUCKET
-- ================================================

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'model-images', 
  'model-images', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload model images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own model images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view model images" ON storage.objects;

-- Create policy for authenticated users to upload images
CREATE POLICY "Authenticated users can upload model images" 
ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'model-images' AND 
  auth.role() = 'authenticated'
);

-- Create policy for public to view images (since bucket is public)
CREATE POLICY "Public can view model images" 
ON storage.objects
FOR SELECT 
USING (bucket_id = 'model-images');

-- Create policy for users to delete their own images
CREATE POLICY "Users can delete their own model images" 
ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'model-images' AND 
  auth.role() = 'authenticated' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for users to update their own images
CREATE POLICY "Users can update their own model images" 
ON storage.objects
FOR UPDATE 
USING (
  bucket_id = 'model-images' AND 
  auth.role() = 'authenticated' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ================================================
-- VERIFICATION
-- ================================================
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'model-images';

-- ================================================
-- STORAGE SETUP COMPLETE!
-- ================================================


