-- PREPARED ONLY: requires reviewed production approval and pgcrypto in extensions.
-- Deploy the disabled AccountChange endpoint first. Do not run AccountSecurity.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public."Users" IN SHARE ROW EXCLUSIVE MODE;
DO $Body$ BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run as postgres'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN RAISE EXCEPTION 'Verify pgcrypto schema first'; END IF;
END; $Body$;

CREATE SCHEMA "PINPrivate";
REVOKE ALL ON SCHEMA "PINPrivate" FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE "PINPrivate"."Key" ("ID" boolean PRIMARY KEY DEFAULT true CHECK ("ID"), "Value" text NOT NULL);
INSERT INTO "PINPrivate"."Key" VALUES (true, encode(extensions.gen_random_bytes(32),'hex'));
CREATE TABLE "PINPrivate"."Records" (
    "UserID" uuid PRIMARY KEY REFERENCES public."Users"("UserID") ON DELETE CASCADE,
    "Hash" text NOT NULL, "Recovery" bytea, "Attempts" integer NOT NULL DEFAULT 0,
    "WindowStart" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "PINPrivate"."Backup" ("UserID" uuid PRIMARY KEY, "Original" bytea NOT NULL);
CREATE TABLE "PINPrivate"."FunctionBackup" ("Signature" text PRIMARY KEY, "Definition" text NOT NULL, "ACL" aclitem[]);
INSERT INTO "PINPrivate"."FunctionBackup"
SELECT p.oid::regprocedure::text, pg_get_functiondef(p.oid), p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('set_my_pin','clear_my_pin','verify_my_pin','developer_get_user_pins','developer_reset_user_pin');
REVOKE ALL ON ALL TABLES IN SCHEMA "PINPrivate" FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE "PINPrivate"."Key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PINPrivate"."Records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PINPrivate"."Backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PINPrivate"."FunctionBackup" ENABLE ROW LEVEL SECURITY;

-- Unknown legacy formats stop the transaction. Never discard an existing PIN.
DO $Body$
DECLARE "Row" record; "PIN" text; "Key" text;
BEGIN
 SELECT "Value" INTO STRICT "Key" FROM "PINPrivate"."Key";
 FOR "Row" IN SELECT "UserID","PINHash" FROM public."Users"
 WHERE "PINHash" IS NOT NULL AND "PINHash" NOT IN ('','null','false') LOOP
  INSERT INTO "PINPrivate"."Backup" VALUES ("Row"."UserID", extensions.pgp_sym_encrypt("Row"."PINHash","Key",'cipher-algo=aes256'));
  IF "Row"."PINHash" ~ '^\$2[aby]\$(0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$' THEN
   INSERT INTO "PINPrivate"."Records"("UserID","Hash") VALUES ("Row"."UserID","Row"."PINHash");
  ELSE
   IF "Row"."PINHash" ~ '^[0-9]{4}$' THEN "PIN" := "Row"."PINHash";
   ELSE
    BEGIN "PIN" := convert_from(decode("Row"."PINHash",'base64'),'UTF8');
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Unsupported legacy PIN format'; END;
   END IF;
   IF "PIN" !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Unsupported legacy PIN format'; END IF;
   INSERT INTO "PINPrivate"."Records"("UserID","Hash","Recovery") VALUES
    ("Row"."UserID",extensions.crypt("PIN",extensions.gen_salt('bf',10)),extensions.pgp_sym_encrypt("PIN","Key",'cipher-algo=aes256'));
  END IF;
 END LOOP;
END;
$Body$;

-- Only the status remains in the public profile; existing auth clients understand it.
UPDATE public."Users" u SET "PINHash"=CASE WHEN EXISTS(SELECT 1 FROM "PINPrivate"."Records" p WHERE p."UserID"=u."UserID") THEN 'true' ELSE NULL END;
CREATE FUNCTION public."ProtectPINStatus"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $Body$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."PINHash" IS NOT NULL THEN RAISE EXCEPTION 'Use verified PIN changes' USING ERRCODE='42501'; END IF;
 ELSIF NEW."PINHash" IS DISTINCT FROM OLD."PINHash" THEN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Use verified PIN changes' USING ERRCODE='42501'; END IF;
  IF NEW."PINHash" IS DISTINCT FROM (CASE WHEN EXISTS(SELECT 1 FROM "PINPrivate"."Records" WHERE "UserID"=NEW."UserID") THEN 'true' ELSE NULL END) THEN
   RAISE EXCEPTION 'PIN status does not match private record';
  END IF;
 END IF;
 RETURN NEW;
END;
$Body$;
CREATE TRIGGER "ProtectPINStatus" BEFORE INSERT OR UPDATE ON public."Users" FOR EACH ROW EXECUTE FUNCTION public."ProtectPINStatus"();

CREATE FUNCTION "PINPrivate"."SetPIN"("TargetUserID" uuid,"NewPIN" text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
DECLARE "Key" text;
BEGIN
 IF "NewPIN" IS NOT NULL AND "NewPIN" !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Invalid PIN'; END IF;
 PERFORM 1 FROM public."Users" WHERE "UserID"="TargetUserID" AND "IsActive"=true AND "Role"<>'Pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 IF "NewPIN" IS NULL THEN DELETE FROM "PINPrivate"."Records" WHERE "UserID"="TargetUserID";
 ELSE
  SELECT "Value" INTO STRICT "Key" FROM "PINPrivate"."Key";
  INSERT INTO "PINPrivate"."Records"("UserID","Hash","Recovery") VALUES
   ("TargetUserID",extensions.crypt("NewPIN",extensions.gen_salt('bf',10)),extensions.pgp_sym_encrypt("NewPIN","Key",'cipher-algo=aes256'))
  ON CONFLICT("UserID") DO UPDATE SET "Hash"=EXCLUDED."Hash","Recovery"=EXCLUDED."Recovery","Attempts"=0,"WindowStart"=now();
 END IF;
 UPDATE public."Users" SET "PINHash"=CASE WHEN "NewPIN" IS NULL THEN NULL ELSE 'true' END WHERE "UserID"="TargetUserID";
 RETURN true;
END;
$Body$;
REVOKE ALL ON FUNCTION "PINPrivate"."SetPIN"(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public."ChangeOwnPIN"("TargetUserID" uuid,"NewPIN" text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 RETURN "PINPrivate"."SetPIN"("TargetUserID","NewPIN");
END;
$Body$;
REVOKE ALL ON FUNCTION public."ChangeOwnPIN"(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public."ChangeOwnPIN"(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.set_my_pin(text), public.clear_my_pin() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.verify_my_pin(entered_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
DECLARE "Record" "PINPrivate"."Records"%ROWTYPE; "Valid" boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."Users" WHERE "UserID"=auth.uid() AND "IsActive"=true AND "Role"<>'Pending') THEN RETURN false; END IF;
 IF entered_pin IS NULL OR entered_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
 SELECT * INTO "Record" FROM "PINPrivate"."Records" WHERE "UserID"=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF "Record"."WindowStart" < now()-interval '15 minutes' THEN "Record"."Attempts":=0; "Record"."WindowStart":=now(); END IF;
 IF "Record"."Attempts">=5 THEN RETURN false; END IF;
 "Valid":=extensions.crypt(entered_pin,"Record"."Hash")="Record"."Hash";
 UPDATE "PINPrivate"."Records" SET "Attempts"=CASE WHEN "Valid" THEN 0 ELSE "Record"."Attempts"+1 END,"WindowStart"="Record"."WindowStart" WHERE "UserID"=auth.uid();
 RETURN "Valid";
END;
$Body$;
CREATE OR REPLACE FUNCTION public.developer_get_user_pins()
RETURNS TABLE("UserID" uuid,"StaffID" varchar,"DisplayName" varchar,"Username" varchar,"Email" varchar,"Role" varchar,"PINHash" varchar,"DecodedPIN" text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
DECLARE "Key" text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."Users" WHERE "UserID"=auth.uid() AND "IsActive"=true AND "Role"='Developer') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT "Value" INTO STRICT "Key" FROM "PINPrivate"."Key";
 RETURN QUERY SELECT u."UserID",u."StaffID",u."DisplayName",u."Username",u."Email",u."Role",u."PINHash",
 CASE WHEN p."UserID" IS NULL THEN 'Not Set' WHEN p."Recovery" IS NULL THEN 'Legacy Encrypted' ELSE extensions.pgp_sym_decrypt(p."Recovery","Key") END
 FROM public."Users" u LEFT JOIN "PINPrivate"."Records" p ON p."UserID"=u."UserID" ORDER BY u."CreatedAt" DESC;
END;
$Body$;
CREATE OR REPLACE FUNCTION public.developer_reset_user_pin(target_user_id uuid,new_pin text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public."Users" WHERE "UserID"=auth.uid() AND "IsActive"=true AND "Role"='Developer') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 RETURN "PINPrivate"."SetPIN"(target_user_id,new_pin);
END;
$Body$;
REVOKE ALL ON FUNCTION public.verify_my_pin(text),public.developer_get_user_pins(),public.developer_reset_user_pin(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.verify_my_pin(text),public.developer_get_user_pins(),public.developer_reset_user_pin(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public."ProtectPINStatus"() FROM PUBLIC,anon,authenticated,service_role;
-- Abort the whole migration if a PIN/status/permission did not survive the move.
DO $Check$
BEGIN
 IF EXISTS(SELECT 1 FROM public."Users" u WHERE u."PINHash" IS DISTINCT FROM
  CASE WHEN EXISTS(SELECT 1 FROM "PINPrivate"."Records" r WHERE r."UserID"=u."UserID") THEN 'true' ELSE NULL END) THEN
  RAISE EXCEPTION 'PIN status verification failed';
 END IF;
 IF EXISTS(SELECT 1 FROM "PINPrivate"."Records" r CROSS JOIN "PINPrivate"."Key" k
  WHERE r."Recovery" IS NOT NULL AND extensions.crypt(extensions.pgp_sym_decrypt(r."Recovery",k."Value"),r."Hash") IS DISTINCT FROM r."Hash") THEN
  RAISE EXCEPTION 'PIN recovery verification failed';
 END IF;
 IF has_schema_privilege('anon','PINPrivate','USAGE') OR has_schema_privilege('authenticated','PINPrivate','USAGE')
  OR has_function_privilege('authenticated','public."ChangeOwnPIN"(uuid,text)','EXECUTE')
  OR NOT has_function_privilege('service_role','public."ChangeOwnPIN"(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'PIN permissions verification failed';
 END IF;
END;
$Check$;
COMMIT;
