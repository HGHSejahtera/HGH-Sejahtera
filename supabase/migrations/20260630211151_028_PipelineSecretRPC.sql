-- Migration 028: Secure RPC for Pipeline Secret Verification

CREATE OR REPLACE FUNCTION public.verify_pipeline_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This string is stored strictly inside the database schema and is never sent to the frontend bundle
    IF p_secret = 'HGH-DUAL-PIPELINE' THEN
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$;

-- Ensure authenticated users can call it
GRANT EXECUTE ON FUNCTION public.verify_pipeline_secret(text) TO authenticated;
