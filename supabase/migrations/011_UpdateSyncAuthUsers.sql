-- Migration 011: Update SyncAuthUsers to fallback to Pending

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public."Users" ("UserID", "Username", "Email", "DisplayName", "Role")
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Pending')
  )
  ON CONFLICT ("UserID") DO UPDATE SET "Role" = EXCLUDED."Role";
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
