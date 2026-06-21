-- Migration 018: Create product-images storage bucket

-- Create a public bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'product-images');

-- Policy to allow authenticated users to update
CREATE POLICY "Authenticated users can update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'product-images');

-- Policy to allow authenticated users to delete
CREATE POLICY "Authenticated users can delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'product-images');
