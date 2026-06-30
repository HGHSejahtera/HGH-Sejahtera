-- Migration 026: Auth PIN System
-- Adds RPCs for setting and verifying user PINs securely using pgcrypto

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. RPC to Set or Update User PIN
CREATE OR REPLACE FUNCTION public.set_my_pin(new_pin text)
RETURNS boolean AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF length(new_pin) != 4 THEN
        RAISE EXCEPTION 'PIN must be exactly 4 characters long';
    END IF;

    UPDATE public."Users"
    SET "PINHash" = crypt(new_pin, gen_salt('bf'))
    WHERE "UserID" = current_user_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC to Verify User PIN
CREATE OR REPLACE FUNCTION public.verify_my_pin(entered_pin text)
RETURNS boolean AS $$
DECLARE
    current_user_id UUID;
    stored_hash text;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT "PINHash" INTO stored_hash
    FROM public."Users"
    WHERE "UserID" = current_user_id;

    IF stored_hash IS NULL THEN
        RETURN false; -- PIN not set yet
    END IF;

    IF stored_hash = crypt(entered_pin, stored_hash) THEN
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.set_my_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_my_pin(text) TO authenticated;
