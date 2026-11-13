-- Independent deterministic idempotency test using ci/fixtures/seed.sql.
\set ON_ERROR_STOP on
BEGIN;
GRANT service_role TO CURRENT_USER;
SET LOCAL ROLE service_role;

DO $assert_idempotent_release$
DECLARE
  v_first jsonb;
  v_second jsonb;
  v_rows bigint;
  v_emp bigint;
  v_global bigint;
  v_src bigint;
  v_status text;
BEGIN
  v_first := public.release_new_photo_upload_quota('14a00000-0000-4000-8000-00000000014a'::uuid);
  IF v_first->>'allowed' IS DISTINCT FROM 'true'
     OR v_first->>'reason' IS DISTINCT FROM 'RELEASED' THEN
    RAISE EXCEPTION 'Q14j FAILED: first release response %', v_first;
  END IF;

  v_second := public.release_new_photo_upload_quota('14a00000-0000-4000-8000-00000000014a'::uuid);
  IF v_second->>'allowed' IS DISTINCT FROM 'false'
     OR v_second->>'reason' IS DISTINCT FROM 'ALREADY_RELEASED' THEN
    RAISE EXCEPTION 'Q14j FAILED: repeat response %', v_second;
  END IF;

  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas
  WHERE scope_key IN ('emp:q14j', 'src:q14j', 'global');
  SELECT attempt_count INTO v_emp FROM private.new_photo_upload_quotas WHERE scope_key = 'emp:q14j';
  SELECT attempt_count INTO v_src FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14j';
  SELECT attempt_count INTO v_global FROM private.new_photo_upload_quotas WHERE scope_key = 'global';
  SELECT status INTO v_status FROM private.new_photo_upload_claims
  WHERE lease_id = '14a00000-0000-4000-8000-00000000014a'::uuid;

  IF v_rows IS DISTINCT FROM 3
     OR v_emp IS DISTINCT FROM 1
     OR v_src IS DISTINCT FROM 2
     OR v_global IS DISTINCT FROM 4
     OR v_status IS DISTINCT FROM 'RELEASED' THEN
    RAISE EXCEPTION 'Q14j FAILED: rows %, status %, emp %, src %, global %',
      v_rows, v_status, v_emp, v_src, v_global;
  END IF;
END;
$assert_idempotent_release$;
RESET ROLE;
ROLLBACK;
