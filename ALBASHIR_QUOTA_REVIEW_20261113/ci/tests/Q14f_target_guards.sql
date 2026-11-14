-- Independent synthetic tests for deferrable constraints on BOTH target tables.
-- Requires ci/bootstrap.sql, seed.sql, and the generated v6.3 test variant.
\set ON_ERROR_STOP on
BEGIN;

DELETE FROM private.new_photo_upload_claims
WHERE lease_id = '14f00000-0000-4000-8000-00000000014e'::uuid;
DELETE FROM private.new_photo_upload_quotas
WHERE scope_key IN ('emp:q14f_guard', 'src:q14f_guard', 'global');

INSERT INTO private.new_photo_upload_quotas (scope_key, attempt_count, window_started_at, updated_at)
VALUES
  ('emp:q14f_guard', 2, '2026-11-13 12:00:00+00', '2026-11-13 12:00:00+00'),
  ('global', 5, '2026-11-13 12:00:00+00', '2026-11-13 12:00:00+00'),
  ('src:q14f_guard', 3, '2026-11-13 12:00:00+00', '2026-11-13 12:00:00+00');
INSERT INTO private.new_photo_upload_claims
  (lease_id, emp_scope, src_scope, emp_window_started_at, src_window_started_at, global_window_started_at, status)
VALUES
  ('14f00000-0000-4000-8000-00000000014e'::uuid,
   'emp:q14f_guard', 'src:q14f_guard',
   '2026-11-13 12:00:00+00', '2026-11-13 12:00:00+00', '2026-11-13 12:00:00+00', 'CLAIMED');

-- Case 1: a deferrable UNIQUE on the quota target must fail closed.
ALTER TABLE private.new_photo_upload_quotas
  ADD CONSTRAINT q14f_quota_target_deferred_uq
  UNIQUE (scope_key, window_started_at) DEFERRABLE INITIALLY DEFERRED;
SET LOCAL ROLE service_role;
DO $assert_quota_target_guard$
DECLARE
  v_caught boolean := false;
  v_sqlstate text;
  v_message text;
BEGIN
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14f00000-0000-4000-8000-00000000014e'::uuid);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    v_caught := position('deferrable' IN lower(v_message)) > 0
      AND position('q14f_quota_target_deferred_uq' IN lower(v_message)) > 0;
  END;
  IF NOT v_caught OR v_sqlstate IS DISTINCT FROM 'P0001' THEN
    RAISE EXCEPTION 'Q14f target-quota guard FAILED: expected P0001 deferrable-constraint rejection; got state=% message=%', v_sqlstate, v_message;
  END IF;
END;
$assert_quota_target_guard$;
RESET ROLE;
ALTER TABLE private.new_photo_upload_quotas DROP CONSTRAINT q14f_quota_target_deferred_uq;

-- Case 2: a deferrable UNIQUE on the claims target must independently fail closed.
ALTER TABLE private.new_photo_upload_claims
  ADD CONSTRAINT q14f_claim_target_deferred_uq
  UNIQUE (lease_id, status) DEFERRABLE INITIALLY DEFERRED;
SET LOCAL ROLE service_role;
DO $assert_claim_target_guard$
DECLARE
  v_caught boolean := false;
  v_sqlstate text;
  v_message text;
BEGIN
  BEGIN
    PERFORM public.release_new_photo_upload_quota('14f00000-0000-4000-8000-00000000014e'::uuid);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    v_caught := position('deferrable' IN lower(v_message)) > 0
      AND position('q14f_claim_target_deferred_uq' IN lower(v_message)) > 0;
  END;
  IF NOT v_caught OR v_sqlstate IS DISTINCT FROM 'P0001' THEN
    RAISE EXCEPTION 'Q14f target-claims guard FAILED: expected P0001 deferrable-constraint rejection; got state=% message=%', v_sqlstate, v_message;
  END IF;
END;
$assert_claim_target_guard$;
RESET ROLE;
ALTER TABLE private.new_photo_upload_claims DROP CONSTRAINT q14f_claim_target_deferred_uq;

-- A catalog guard must reject before mutation in either target-table case.
DO $assert_no_mutation$
DECLARE
  v_count bigint;
  v_status text;
BEGIN
  SELECT count(*) INTO v_count
  FROM private.new_photo_upload_quotas
  WHERE scope_key IN ('emp:q14f_guard', 'src:q14f_guard', 'global');
  IF v_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Q14f target guard FAILED: missing quota rows (%)', v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.new_photo_upload_quotas
    WHERE scope_key IN ('emp:q14f_guard', 'src:q14f_guard') AND attempt_count IS DISTINCT FROM 2
  ) OR EXISTS (
    SELECT 1 FROM private.new_photo_upload_quotas
    WHERE scope_key = 'global' AND attempt_count IS DISTINCT FROM 5
  ) THEN
    RAISE EXCEPTION 'Q14f target guard FAILED: quota rows mutated despite rejection';
  END IF;
  SELECT status INTO v_status FROM private.new_photo_upload_claims
  WHERE lease_id = '14f00000-0000-4000-8000-00000000014e'::uuid;
  IF v_status IS DISTINCT FROM 'CLAIMED' THEN
    RAISE EXCEPTION 'Q14f target guard FAILED: claim status changed to %', v_status;
  END IF;
END;
$assert_no_mutation$;

ROLLBACK;
