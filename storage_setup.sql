-- ===============================================
-- STORAGE SETUP FOR DRESSED MODELS
-- ===============================================

-- Create storage bucket for dressed models
INSERT INTO storage.buckets (id, name, public)
VALUES ('dressed-models', 'dressed-models', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload their own images
CREATE POLICY "Users can upload dressed models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dressed-models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own images
CREATE POLICY "Users can update their dressed models"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dressed-models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their dressed models"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dressed-models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to all images
CREATE POLICY "Public read access to dressed models"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dressed-models');

