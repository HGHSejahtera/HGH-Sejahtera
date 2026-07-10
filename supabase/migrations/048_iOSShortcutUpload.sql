-- =============================================
-- Migration 048: iOS Shortcut Upload Infrastructure
-- Adds UploadToken to Users and PendingAWBUploads table
-- =============================================

-- 1. Add UploadToken column to Users table
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "UploadToken" UUID DEFAULT gen_random_uuid();

-- 2. Generate tokens for existing agents who don't have one
UPDATE "Users" SET "UploadToken" = gen_random_uuid() WHERE "UploadToken" IS NULL;

-- 3. Create PendingAWBUploads table for iOS Shortcut uploads
CREATE TABLE IF NOT EXISTS "PendingAWBUploads" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "StaffID" TEXT NOT NULL REFERENCES "Users"("StaffID") ON DELETE CASCADE,
    "UserID" UUID NOT NULL,
    "FileName" TEXT NOT NULL,
    "FilePath" TEXT NOT NULL,
    "Status" TEXT DEFAULT 'Pending' CHECK ("Status" IN ('Pending', 'Processed')),
    "CreatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Supabase Storage bucket for pending AWB uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('pending-awb', 'pending-awb', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policy: allow service role full access (API endpoint uses service role key)
CREATE POLICY "Service role full access on pending-awb"
ON storage.objects FOR ALL
USING (bucket_id = 'pending-awb')
WITH CHECK (bucket_id = 'pending-awb');

-- 6. RPC: Validate upload token and return agent info
CREATE OR REPLACE FUNCTION validate_upload_token(p_token UUID)
RETURNS TABLE("StaffID" TEXT, "UserID" UUID, "DisplayName" TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT u."StaffID", u."UserID", u."DisplayName"
    FROM "Users" u
    WHERE u."UploadToken" = p_token
      AND u."Role" = 'Agent'
      AND u."IsActive" = true;
END;
$$;

-- 7. RPC: Get pending uploads for an agent
CREATE OR REPLACE FUNCTION get_pending_uploads(p_user_id UUID)
RETURNS TABLE(
    "id" UUID,
    "FileName" TEXT,
    "FilePath" TEXT,
    "CreatedAt" TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT p."id", p."FileName", p."FilePath", p."CreatedAt"
    FROM "PendingAWBUploads" p
    WHERE p."UserID" = p_user_id
      AND p."Status" = 'Pending'
    ORDER BY p."CreatedAt" ASC;
END;
$$;

-- 8. RPC: Mark pending upload as processed
CREATE OR REPLACE FUNCTION mark_upload_processed(p_upload_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE "PendingAWBUploads"
    SET "Status" = 'Processed'
    WHERE "id" = p_upload_id;
END;
$$;

-- 9. RLS policies for PendingAWBUploads
ALTER TABLE "PendingAWBUploads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own pending uploads"
ON "PendingAWBUploads" FOR SELECT
USING (
    "UserID" = auth.uid()
);

CREATE POLICY "Service role can insert pending uploads"
ON "PendingAWBUploads" FOR INSERT
WITH CHECK (true);

CREATE POLICY "Agents can update own pending uploads"
ON "PendingAWBUploads" FOR UPDATE
USING (
    "UserID" = auth.uid()
);
