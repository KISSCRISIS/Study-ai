-- ALBASHIR QA Test: Q14h.sql
-- Purpose: Verify atomic rollback on third-scope failure and idempotent retry.
-- Target: PostgreSQL 16 synthetic isolated QA only.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

DO $setup_roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$setup_roles$;

GRANT service_role TO CURRENT_USER;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.new_photo_upload_quotas (
  scope_key text COLLATE "C" PRIMARY KEY,
  attempt_count bigint NOT NULL CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS private.new_photo_upload_claims (
  lease_id uuid PRIMARY KEY,
  emp_scope text COLLATE "C" NOT NULL,
  src_scope text COLLATE "C" NOT NULL,
  emp_window_started_at timestamptz NOT NULL,
  src_window_started_at timestamptz NOT NULL,
  global_window_started_at timestamptz NOT NULL,
  status text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz
);

GRANT SELECT ON private.new_photo_upload_quotas, private.new_photo_upload_claims TO service_role;

-- Setup: source scope zero to force failure after prior updates.
DELETE FROM private.new_photo_upload_claims WHERE lease_id = '14800000-0000-4000-8000-000000000148'::uuid;
DELETE FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14h', 'src:q14h', 'global');

INSERT INTO private.new_photo_upload_quotas (scope_key, attempt_count, window_started_at, updated_at)
VALUES
  ('emp:q14h', 3, '2026-11-13 10:00:00+00'::timestamptz, '2026-11-13 10:00:00+00'::timestamptz),
  ('global',   7, '2026-11-13 10:00:00+00'::timestamptz, '2026-11-13 10:00:00+00'::timestamptz),
  ('src:q14h', 0, '2026-11-13 10:00:00+00'::timestamptz, '2026-11-13 10:00:00+00'::timestamptz);

INSERT INTO private.new_photo_upload_claims (
  lease_id, emp_scope, src_scope,
  emp_window_started_at, src_window_started_at, global_window_started_at,
  status
) VALUES (
  '14800000-0000-4000-8000-000000000148'::uuid,
  'emp:q14h', 'src:q14h',
  '2026-11-13 10:00:00+00'::timestamptz,
  '2026-11-13 10:00:00+00'::timestamptz,
  '2026-11-13 10:00:00+00'::timestamptz,
  'CLAIMED'
);

SET LOCAL ROLE service_role;

DO $verify_q14h$
DECLARE
  v_failed_as_expected boolean := false;
  v_sqlstate text;
  v_sqlerrm text;
  v_status text;
  v_released_at timestamptz;
  v_claim_found boolean := false;
  v_rows bigint;
  v_emp_cnt bigint;
  v_glb_cnt bigint;
  v_src_cnt bigint;
  v_res_retry jsonb;
  v_res_idempotent jsonb;
BEGIN
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14800000-0000-4000-8000-000000000148'::uuid);
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
      IF position('quota count not positive' IN lower(v_sqlerrm)) = 0 THEN
        RAISE EXCEPTION 'Q14h FAILED: P0001 was not the intended zero third-scope counter failure: %', v_sqlerrm;
      END IF;
      v_failed_as_expected := true;
  END;

  IF NOT v_failed_as_expected THEN
    RAISE EXCEPTION 'Q14h FAILED: Attempt 1 succeeded despite corrupted 3rd scope';
  END IF;

  SELECT status, released_at INTO v_status, v_released_at
  FROM private.new_photo_upload_claims
  WHERE lease_id = '14800000-0000-4000-8000-000000000148'::uuid;
  v_claim_found := FOUND;

  SELECT attempt_count INTO v_emp_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'emp:q14h';
  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';
  SELECT attempt_count INTO v_src_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14h';

  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14h', 'src:q14h', 'global');

  IF NOT v_claim_found
     OR v_rows IS DISTINCT FROM 3
     OR v_status IS DISTINCT FROM 'CLAIMED'
     OR v_released_at IS NOT NULL
     OR v_emp_cnt IS DISTINCT FROM 3
     OR v_glb_cnt IS DISTINCT FROM 7
     OR v_src_cnt IS DISTINCT FROM 0
  THEN
    RAISE EXCEPTION 'Q14h FAILED: partial state leaked after rollback (status=%, released_at=%, emp=%, global=%, src=%)',
      v_status, v_released_at, v_emp_cnt, v_glb_cnt, v_src_cnt;
  END IF;
END;
$verify_q14h$;

RESET ROLE;

UPDATE private.new_photo_upload_quotas
SET attempt_count = 4
WHERE scope_key = 'src:q14h';

SET LOCAL ROLE service_role;

DO $verify_q14h_retry$
DECLARE
  v_res_retry jsonb;
  v_res_idempotent jsonb;
  v_status text;
  v_released_at timestamptz;
  v_claim_found boolean := false;
  v_rows bigint;
  v_emp_cnt bigint;
  v_glb_cnt bigint;
  v_src_cnt bigint;
BEGIN
  v_res_retry := public.release_new_photo_upload_quota('14800000-0000-4000-8000-000000000148'::uuid);
  IF v_res_retry->>'allowed' IS DISTINCT FROM 'true' OR v_res_retry->>'reason' IS DISTINCT FROM 'RELEASED' THEN
    RAISE EXCEPTION 'Q14h FAILED on Retry (Attempt 2): %', v_res_retry;
  END IF;

  SELECT status, released_at INTO v_status, v_released_at
  FROM private.new_photo_upload_claims
  WHERE lease_id = '14800000-0000-4000-8000-000000000148'::uuid;
  v_claim_found := FOUND;

  SELECT attempt_count INTO v_emp_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'emp:q14h';
  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';
  SELECT attempt_count INTO v_src_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14h';

  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14h', 'src:q14h', 'global');

  IF NOT v_claim_found
     OR v_rows IS DISTINCT FROM 3
     OR v_status IS DISTINCT FROM 'RELEASED'
     OR v_released_at IS NULL
     OR v_emp_cnt IS DISTINCT FROM 2
     OR v_glb_cnt IS DISTINCT FROM 6
     OR v_src_cnt IS DISTINCT FROM 3
  THEN
    RAISE EXCEPTION 'Q14h FAILED after Retry: state mismatch (status=%, emp=%, global=%, src=%)',
      v_status, v_emp_cnt, v_glb_cnt, v_src_cnt;
  END IF;

  v_res_idempotent := public.release_new_photo_upload_quota('14800000-0000-4000-8000-000000000148'::uuid);
  IF v_res_idempotent->>'allowed' IS DISTINCT FROM 'false'
     OR v_res_idempotent->>'reason' IS DISTINCT FROM 'ALREADY_RELEASED'
  THEN
    RAISE EXCEPTION 'Q14h FAILED on Idempotent Repeat (Attempt 3): %', v_res_idempotent;
  END IF;

  SELECT attempt_count INTO v_emp_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'emp:q14h';
  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';
  SELECT attempt_count INTO v_src_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14h';

  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14h', 'src:q14h', 'global');

  IF v_rows IS DISTINCT FROM 3
     OR v_emp_cnt IS DISTINCT FROM 2
     OR v_glb_cnt IS DISTINCT FROM 6
     OR v_src_cnt IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Q14h FAILED: double-decrement detected on Attempt 3 (emp=%, global=%, src=%)',
      v_emp_cnt, v_glb_cnt, v_src_cnt;
  END IF;
END;
$verify_q14h_retry$;

RESET ROLE;

ROLLBACK;