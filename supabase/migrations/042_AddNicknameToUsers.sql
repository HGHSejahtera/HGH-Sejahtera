-- ==============================================================================
-- Migration 042: Add Nickname Column to Users Table & Update Trigger
-- Description: Adds "Nickname" column to public."Users" and updates the 
-- handle_new_user() trigger function to capture nickname from auth metadata.
-- ==============================================================================

-- 1. Add Nickname column to public."Users" table
ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS "Nickname" VARCHAR(50);

-- 2. Update handle_new_user function to extract Nickname from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_prefix VARCHAR(3);
  v_next_id INT;
  v_staff_id VARCHAR(20);
  v_role VARCHAR(20);
  v_nickname VARCHAR(50);
BEGIN
  -- Get role, default to Pending if not specified
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'Pending');
  
  -- Extract nickname, format uppercase first letter (INITCAP), convert empty strings to NULL
  v_nickname := NULLIF(INITCAP(TRIM(COALESCE(new.raw_user_meta_data->>'nickname', ''))), '');

  -- Determine prefix based on role
  IF v_role = 'Founder' THEN v_prefix := 'FDR';
  ELSIF v_role = 'Manager' THEN v_prefix := 'MGR';
  ELSIF v_role = 'Developer' THEN v_prefix := 'DEV';
  ELSIF v_role = 'Agent' THEN v_prefix := 'AGT';
  ELSE v_prefix := 'STF'; -- Staff and Pending
  END IF;

  -- Find highest existing ID for this prefix
  SELECT COALESCE(MAX(NULLIF(regexp_replace("StaffID", '\D', '', 'g'), '')::INT), 0) + 1
  INTO v_next_id
  FROM public."Users"
  WHERE "StaffID" LIKE v_prefix || '%';

  -- Format with padding: e.g. FDR001
  v_staff_id := v_prefix || LPAD(v_next_id::text, 3, '0');

  -- Insert into public.Users
  INSERT INTO public."Users" ("UserID", "Username", "Email", "StaffID", "DisplayName", "Role", "Nickname")
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    v_staff_id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_nickname
  )
  ON CONFLICT ("UserID") DO UPDATE SET 
    "Role" = EXCLUDED."Role",
    "Username" = EXCLUDED."Username",
    "StaffID" = EXCLUDED."StaffID",
    "Nickname" = COALESCE(EXCLUDED."Nickname", public."Users"."Nickname");
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Populate Nickname for existing users
UPDATE public."Users" SET "Nickname" = 'Fariz' WHERE "UserID" = '0348d9fc-4880-4122-9578-6d7e7cbe3f4d' OR "StaffID" = 'DEV001';
UPDATE public."Users" SET "Nickname" = 'Irfan' WHERE "UserID" = '8e5b3e81-8eaa-49ae-91bd-47184be2db39' OR "StaffID" = 'MGR001';
UPDATE public."Users" SET "Nickname" = 'Syahmi' WHERE "UserID" = '9bd828e5-8a7e-4a9c-9dec-82fddf3fe67f' OR "StaffID" = 'AGT001';
