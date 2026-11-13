-- Attack simulation only: caller-controlled JWT claim GUC must not grant EXECUTE.
-- The candidate's security boundary is the real PostgreSQL function ACL, not this GUC.
\set ON_ERROR_STOP on
BEGIN;
GRANT authenticated TO CURRENT_USER;
SET LOCAL "request.jwt.claim.role" = 'service_role';
SET LOCAL ROLE authenticated;

DO $assert_jwt_spoof_denied$
DECLARE
  v_denied boolean := false;
  v_function regprocedure := 'public.release_new_photo_upload_quota(uuid)'::regprocedure;
BEGIN
  IF has_function_privilege(CURRENT_USER, v_function, 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Q14k FAILED: authenticated effective EXECUTE is unexpectedly true';
  END IF;
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14a00000-0000-4000-8000-00000000014a'::uuid);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Q14k FAILED: spoofed JWT role GUC bypassed ACL';
  END IF;
END;
$assert_jwt_spoof_denied$;
RESET ROLE;
ROLLBACK;
