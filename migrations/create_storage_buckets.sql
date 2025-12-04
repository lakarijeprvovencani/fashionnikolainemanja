-- =====================================================
-- CREATE STORAGE BUCKETS FOR FASHION APP
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create buckets (skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('model-images', 'model-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dressed-models', 'dressed-models', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clothing-library', 'clothing-library', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('generated-ads', 'generated-ads', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-assets', 'brand-assets', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DROP EXISTING POLICIES (ignore errors if they don't exist)
-- =====================================================

-- model-images policies
DROP POLICY IF EXISTS "Users can upload model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their model images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their model images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view model images" ON storage.objects;

-- dressed-models policies
DROP POLICY IF EXISTS "Users can upload dressed models" ON storage.objects;
DROP POLICY IF EXISTS "Users can view dressed models" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their dressed models" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their dressed models" ON storage.objects;
DROP POLICY IF EXISTS "Public can view dressed models" ON storage.objects;

-- clothing-library policies
DROP POLICY IF EXISTS "Users can upload clothing items" ON storage.objects;
DROP POLICY IF EXISTS "Users can view clothing items" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their clothing items" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their clothing items" ON storage.objects;
DROP POLICY IF EXISTS "Public can view clothing items" ON storage.objects;

-- generated-ads policies
DROP POLICY IF EXISTS "Users can upload generated ads" ON storage.objects;
DROP POLICY IF EXISTS "Users can view generated ads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their generated ads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their generated ads" ON storage.objects;
DROP POLICY IF EXISTS "Public can view generated ads" ON storage.objects;

-- brand-assets policies
DROP POLICY IF EXISTS "Users can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view brand assets" ON storage.objects;

-- =====================================================
-- CREATE NEW POLICIES
-- =====================================================

-- model-images
CREATE POLICY "Users can upload model images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'model-images');

CREATE POLICY "Users can view model images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'model-images');

CREATE POLICY "Users can update their model images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'model-images');

CREATE POLICY "Users can delete their model images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'model-images');

CREATE POLICY "Public can view model images" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'model-images');

-- dressed-models
CREATE POLICY "Users can upload dressed models" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dressed-models');

CREATE POLICY "Users can view dressed models" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dressed-models');

CREATE POLICY "Users can update their dressed models" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'dressed-models');

CREATE POLICY "Users can delete their dressed models" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dressed-models');

CREATE POLICY "Public can view dressed models" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'dressed-models');

-- clothing-library
CREATE POLICY "Users can upload clothing items" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clothing-library');

CREATE POLICY "Users can view clothing items" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clothing-library');

CREATE POLICY "Users can update their clothing items" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clothing-library');

CREATE POLICY "Users can delete their clothing items" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clothing-library');

CREATE POLICY "Public can view clothing items" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'clothing-library');

-- generated-ads
CREATE POLICY "Users can upload generated ads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-ads');

CREATE POLICY "Users can view generated ads" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-ads');

CREATE POLICY "Users can update their generated ads" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-ads');

CREATE POLICY "Users can delete their generated ads" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-ads');

CREATE POLICY "Public can view generated ads" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'generated-ads');

-- brand-assets
CREATE POLICY "Users can upload brand assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "Users can view brand assets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets');

CREATE POLICY "Users can update their brand assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-assets');

CREATE POLICY "Users can delete their brand assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-assets');

CREATE POLICY "Public can view brand assets" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'brand-assets');

-- =====================================================
-- VERIFY
-- =====================================================
SELECT id, name, public FROM storage.buckets 
WHERE id IN ('model-images', 'dressed-models', 'clothing-library', 'generated-ads', 'brand-assets');
