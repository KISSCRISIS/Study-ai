-- Synthetic ACL test. It verifies effective PostgreSQL EXECUTE privileges.
\set ON_ERROR_STOP on
BEGIN;
GRANT anon TO CURRENT_USER;
GRANT authenticated TO CURRENT_USER;
GRANT service_role TO CURRENT_USER;

DO $assert_effective_acl$
DECLARE
  v_function regprocedure := 'public.release_new_photo_upload_quota(uuid)'::regprocedure;
BEGIN
  IF has_function_privilege('service_role', v_function, 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Q14i FAILED: service_role lacks EXECUTE';
  END IF;
  IF has_function_privilege('anon', v_function, 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Q14i FAILED: anon has effective EXECUTE';
  END IF;
  IF has_function_privilege('authenticated', v_function, 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Q14i FAILED: authenticated has effective EXECUTE';
  END IF;
  IF has_function_privilege(CURRENT_USER, v_function, 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Q14i FAILED: test harness owner cannot inspect the function';
  END IF;
END;
$assert_effective_acl$;

-- Verify actual invocation denial for both public-facing roles. Assertions are
-- outside the exception subblocks so synthetic failures cannot be swallowed.
SET LOCAL ROLE anon;
DO $assert_anon_denied$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14a00000-0000-4000-8000-00000000014a'::uuid);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Q14i FAILED: anon invocation was not denied with 42501';
  END IF;
END;
$assert_anon_denied$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $assert_authenticated_denied$
DECLARE v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14a00000-0000-4000-8000-00000000014a'::uuid);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Q14i FAILED: authenticated invocation was not denied with 42501';
  END IF;
END;
$assert_authenticated_denied$;
RESET ROLE;
ROLLBACK;
