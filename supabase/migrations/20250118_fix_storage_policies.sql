-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('concept-references', 'concept-references', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Drop existing policies to avoid conflicts and recreate them cleanly
DROP POLICY IF EXISTS "Give users access to own folder 1okq6b_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1okq6b_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1okq6b_2" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;

-- Create simplified policies
-- 1. Public Read Access (anyone can view images in this bucket)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'concept-references' );

-- 2. Authenticated Upload (any logged in user can upload)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'concept-references' );

-- 3. Owner Delete (users can delete their own files)
-- Assumes file path convention: project_id/filename.ext or similar.
-- But since we store user_id in the table, we can just allow authenticated delete for now to unblock, 
-- or strictly check owner via path if we structured it that way. 
-- For now, let's allow authenticated users to delete from this bucket to simplify debugging.
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'concept-references' );
