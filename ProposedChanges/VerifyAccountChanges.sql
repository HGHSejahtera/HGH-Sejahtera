-- Read-only. No account values or credentials are returned.
SELECT count(*) AS "EmailMismatch" FROM public."Users" u JOIN auth.users a ON a.id=u."UserID"
WHERE u."Email" IS DISTINCT FROM a.email;
SELECT count(*) AS "IdentifierCollisions" FROM public."Users" a JOIN public."Users" b
ON a."UserID"<>b."UserID" AND (lower(a."Username")=lower(b."Username") OR lower(a."Username")=lower(b."StaffID"));
SELECT "Role",has_function_privilege("Role",'public."ChangeOwnUsername"(uuid,text)','EXECUTE') AS "CanChangeUsername"
FROM (VALUES('anon'),('authenticated'),('service_role')) r("Role");
SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgname IN ('ProtectAccountChanges','ProtectLoginIdentifiers','SyncConfirmedAccountEmail');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('UsersUsernameFolded','UsersStaffIDFolded');
