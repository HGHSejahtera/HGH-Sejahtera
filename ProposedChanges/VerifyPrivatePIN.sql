-- Read-only checks after the separately approved migration. Returns no PIN/key values.
SELECT count(*) FILTER (WHERE "PINHash" IS NOT NULL AND "PINHash" <> 'true') AS "UnsafePublicValues"
FROM public."Users";
SELECT count(*) AS "StatusMismatch" FROM public."Users" u
WHERE u."PINHash" IS DISTINCT FROM CASE WHEN EXISTS(SELECT 1 FROM "PINPrivate"."Records" p WHERE p."UserID"=u."UserID") THEN 'true' ELSE NULL END;
SELECT "Role", has_schema_privilege("Role",'PINPrivate','USAGE') AS "PrivateAccess",
has_function_privilege("Role",'public."ChangeOwnPIN"(uuid,text)','EXECUTE') AS "CanChangePIN",
has_function_privilege("Role",'public.set_my_pin(text)','EXECUTE') AS "LegacyWrite",
has_function_privilege("Role",'public.developer_get_user_pins()','EXECUTE') AS "RecoveryRPC"
FROM (VALUES ('anon'),('authenticated'),('service_role')) r("Role");
SELECT p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('ChangeOwnPIN','verify_my_pin','developer_get_user_pins','developer_reset_user_pin');
