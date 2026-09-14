-- Prepared migration: apply only after approval of the account-change batch.
-- Does not replace PIN functions or modify existing usernames/emails.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public."Users" IN SHARE ROW EXCLUSIVE MODE;
DO $Check$ BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run as postgres'; END IF;
 IF EXISTS(SELECT 1 FROM public."Users" u JOIN auth.users a ON a.id=u."UserID" WHERE u."Email" IS DISTINCT FROM a.email) THEN
  RAISE EXCEPTION 'Resolve existing confirmed email mismatches before migration';
 END IF;
 IF EXISTS(SELECT 1 FROM public."Users" a JOIN public."Users" b ON a."UserID"<>b."UserID"
  AND (lower(a."Username")=lower(b."Username") OR lower(a."Username")=lower(b."StaffID"))) THEN
  RAISE EXCEPTION 'Resolve existing login identifier collisions before migration';
 END IF;
END; $Check$;

CREATE UNIQUE INDEX "UsersUsernameFolded" ON public."Users"(lower("Username"));
CREATE UNIQUE INDEX "UsersStaffIDFolded" ON public."Users"(lower("StaffID"));

-- Protect every update, including direct REST writes. Existing privileged
-- service/Auth writers retain their authority; browser roles cannot bypass it.
CREATE FUNCTION public."ProtectAccountChanges"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $Body$
BEGIN
 IF (NEW."Username" IS DISTINCT FROM OLD."Username" OR NEW."Email" IS DISTINCT FROM OLD."Email")
 AND current_user NOT IN ('postgres','service_role','supabase_auth_admin') THEN
  RAISE EXCEPTION 'Use verified account changes' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END; $Body$;
CREATE TRIGGER "ProtectAccountChanges" BEFORE UPDATE ON public."Users"
FOR EACH ROW EXECUTE FUNCTION public."ProtectAccountChanges"();

-- Both signup and StaffID approval use this same namespace check.
CREATE FUNCTION public."ProtectLoginIdentifiers"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
BEGIN
 IF TG_OP='UPDATE' AND NEW."Username" IS NOT DISTINCT FROM OLD."Username"
 AND NEW."StaffID" IS NOT DISTINCT FROM OLD."StaffID" THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(712731);
 IF EXISTS(SELECT 1 FROM public."Users" u WHERE u."UserID"<>NEW."UserID" AND
  (lower(u."Username")=lower(NEW."Username") OR lower(u."StaffID")=lower(NEW."Username")
   OR lower(u."Username")=lower(NEW."StaffID") OR lower(u."StaffID")=lower(NEW."StaffID"))) THEN
  RAISE EXCEPTION 'Login identifier taken' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END; $Body$;
CREATE TRIGGER "ProtectLoginIdentifiers" BEFORE INSERT OR UPDATE OF "Username","StaffID" ON public."Users"
FOR EACH ROW EXECUTE FUNCTION public."ProtectLoginIdentifiers"();

CREATE FUNCTION public."ChangeOwnUsername"("TargetUserID" uuid,"NewUsername" text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF "NewUsername" IS NULL OR "NewUsername" !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$' THEN
  RAISE EXCEPTION 'Invalid username' USING ERRCODE='22023';
 END IF;
 UPDATE public."Users" SET "Username"="NewUsername"
 WHERE "UserID"="TargetUserID" AND "IsActive"=true AND "Role" NOT IN ('Pending','Rejected');
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 RETURN true;
END; $Body$;
REVOKE ALL ON FUNCTION public."ChangeOwnUsername"(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public."ChangeOwnUsername"(uuid,text) TO service_role;

-- Auth changes email only when its confirmation flow succeeds. Never copy new_email.
CREATE FUNCTION public."SyncConfirmedAccountEmail"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $Body$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email THEN
  UPDATE public."Users" SET "Email"=NEW.email WHERE "UserID"=NEW.id;
 END IF;
 RETURN NEW;
END; $Body$;
CREATE TRIGGER "SyncConfirmedAccountEmail" AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public."SyncConfirmedAccountEmail"();
REVOKE ALL ON FUNCTION public."ProtectAccountChanges"(),public."ProtectLoginIdentifiers"(),public."SyncConfirmedAccountEmail"()
FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
