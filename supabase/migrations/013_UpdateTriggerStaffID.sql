-- Migration 013: Update handle_new_user to auto-generate StaffID and sync Username

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_prefix VARCHAR(3);
  v_next_id INT;
  v_staff_id VARCHAR(20);
  v_role VARCHAR(20);
BEGIN
  -- Get role, default to Pending if not specified
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'Pending');

  -- Determine prefix based on role
  IF v_role = 'Founder' THEN v_prefix := 'FDR';
  ELSIF v_role = 'Manager' THEN v_prefix := 'MGR';
  ELSIF v_role = 'Developer' THEN v_prefix := 'DEV';
  ELSIF v_role = 'Agent' THEN v_prefix := 'AGT';
  ELSE v_prefix := 'STF'; -- Staff and Pending
  END IF;

  -- Find highest existing ID for this prefix
  -- We extract the numeric part, convert to INT, find MAX, then add 1
  SELECT COALESCE(MAX(NULLIF(regexp_replace("StaffID", '\D', '', 'g'), '')::INT), 0) + 1
  INTO v_next_id
  FROM public."Users"
  WHERE "StaffID" LIKE v_prefix || '%';

  -- Format with padding: e.g. FDR001
  v_staff_id := v_prefix || LPAD(v_next_id::text, 3, '0');

  -- Insert into public.Users
  INSERT INTO public."Users" ("UserID", "Username", "Email", "StaffID", "DisplayName", "Role")
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    v_staff_id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role
  )
  ON CONFLICT ("UserID") DO UPDATE SET 
    "Role" = EXCLUDED."Role",
    "Username" = EXCLUDED."Username",
    "StaffID" = EXCLUDED."StaffID";
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
