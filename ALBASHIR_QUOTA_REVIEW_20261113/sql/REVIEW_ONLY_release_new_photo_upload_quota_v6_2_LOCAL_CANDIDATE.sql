-- ALBASHIR / Principal PostgreSQL 16 & Concurrency Review Candidate — vNext_FIXED (v6.2 / 2026-11-13)
-- STATUS: REVIEW ONLY / INTENTIONALLY LOCKED — DO NOT DEPLOY TO PRODUCTION OR STAGING.
-- SOURCE: locally reconstructed from v6 reference plus v6.1 changes supplied in chat.
-- CAUTION: review-only candidate; not PostgreSQL-16 verified; do not deploy.
-- Prerequisites: inspect missing original SQL source; capture catalog snapshot;
-- approve Q08/Q09 policy; run PostgreSQL 16 synthetic regression.
-- v6 intent: no SET CONSTRAINTS commands; deferrable trigger fail-closed guard;
-- canonical quotas-before-claims row locks and full post-update attestation.

BEGIN;

DO $deployment_lock$
BEGIN
  RAISE EXCEPTION 'REVIEW ONLY: DO NOT EXECUTE; new-only quota release vNext_FIXED requires full schema, trigger inventory, PG16 container verification, and rollback approval';
END;
$deployment_lock$;

CREATE OR REPLACE FUNCTION public.release_new_photo_upload_quota(p_lease_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $function$
DECLARE
  v_claim record;
  v_quota record;
  v_def_trig record;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_req_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  v_active_role text := COALESCE(NULLIF(pg_catalog.current_setting('role', true), 'none'), '');
  v_has_service_role boolean := false;
  v_is_superuser boolean := false;
  v_emp_scope text;
  v_src_scope text;
  v_emp_window timestamptz;
  v_src_window timestamptz;
  v_global_window timestamptz;
  v_locked_scopes integer := 0;
  v_processed_scopes integer := 0;
  v_verified_scopes integer := 0;
  v_affected integer := 0;
  v_lease_status text;
  v_lease_released_at timestamptz;
  v_ret_emp_scope text;
  v_ret_src_scope text;
  v_ret_emp_window timestamptz;
  v_ret_src_window timestamptz;
  v_ret_global_window timestamptz;
  v_expected_window timestamptz;
  v_count_after bigint;
  v_window_after timestamptz;
  v_updated_after timestamptz;
  v_count_confirmed bigint;
  v_window_confirmed timestamptz;
  v_exp_emp_count bigint;
  v_exp_src_count bigint;
  v_exp_global_count bigint;
  v_exp_emp_window timestamptz;
  v_exp_src_window timestamptz;
  v_exp_global_window timestamptz;
BEGIN
  -- 1. Defense-in-depth authorization check (as supplied in Gemini v6).
  SELECT r.rolsuper
  INTO v_is_superuser
  FROM pg_catalog.pg_roles AS r
  WHERE r.rolname = session_user;
  v_is_superuser := COALESCE(v_is_superuser, false);

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles AS r WHERE r.rolname = 'service_role') THEN
    v_has_service_role := pg_catalog.pg_has_role(session_user, 'service_role', 'MEMBER');
  END IF;

  IF session_user IN ('anon', 'authenticated')
     OR v_active_role IN ('anon', 'authenticated')
     OR (v_req_jwt_role <> '' AND v_req_jwt_role <> 'service_role')
     OR NOT (
       session_user = 'service_role'
       OR (v_active_role = 'service_role' AND (v_has_service_role OR v_is_superuser))
       OR (v_req_jwt_role = 'service_role' AND (v_has_service_role OR v_is_superuser))
     )
  THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'UNAUTHORIZED_ROLE');
  END IF;

  IF p_lease_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'INVALID_LEASE_ID');
  END IF;

  -- 2. Fail-Closed Deferrable Trigger & Constraint Guard on Target Tables ONLY (Q14d–Q14g).
  FOR v_def_trig IN
    SELECT DISTINCT
           n.nspname AS schema_name,
           c.relname AS table_name,
           COALESCE(con.conname, t.tgname) AS object_name,
           t.oid AS trigger_oid,
           con.oid AS constraint_oid
    FROM pg_catalog.pg_trigger AS t
    JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_constraint AS con ON con.oid = t.tgconstraint
    WHERE n.nspname = 'private'
      AND c.relname IN ('new_photo_upload_quotas', 'new_photo_upload_claims')
      AND t.tgenabled <> 'D'
      AND (t.tgdeferrable = true OR COALESCE(con.condeferrable, false) = true)
    ORDER BY 1, 2, 3
  LOOP
    RAISE EXCEPTION 'Quota release state transition failed: prohibited deferrable trigger or constraint (%) attached to %.%',
      v_def_trig.object_name, v_def_trig.schema_name, v_def_trig.table_name
      USING ERRCODE = 'P0001';
  END LOOP;

  -- Catalog coverage note: deferrable UNIQUE/PRIMARY KEY constraints can exist
  -- without a matching pg_trigger row; check pg_constraint directly too.
  FOR v_def_trig IN
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           con.conname AS object_name
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relname IN ('new_photo_upload_quotas', 'new_photo_upload_claims')
      AND con.condeferrable
  LOOP
    RAISE EXCEPTION 'Quota release rejected: deferrable constraint (%) on %.%',
      v_def_trig.object_name, v_def_trig.schema_name, v_def_trig.table_name
      USING ERRCODE = 'P0001';
  END LOOP;

  -- 2. Non-locking pre-read to obtain immutable scope keys for canonical lock ordering.
  SELECT c.lease_id,
         c.emp_scope,
         c.src_scope,
         c.emp_window_started_at,
         c.src_window_started_at,
         c.global_window_started_at,
         c.status
  INTO v_claim
  FROM private.new_photo_upload_claims AS c
  WHERE c.lease_id = p_lease_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'LEASE_NOT_FOUND');
  END IF;

  v_emp_scope := v_claim.emp_scope;
  v_src_scope := v_claim.src_scope;
  v_emp_window := v_claim.emp_window_started_at;
  v_src_window := v_claim.src_window_started_at;
  v_global_window := v_claim.global_window_started_at;

  -- Enforce strict prefix invariants ('emp:...' < 'global' < 'src:...' under COLLATE "C")
  IF v_emp_scope IS NULL OR v_src_scope IS NULL
     OR pg_catalog.btrim(v_emp_scope) = '' OR pg_catalog.btrim(v_src_scope) = ''
     OR v_emp_scope = v_src_scope
     OR v_emp_scope = 'global' OR v_src_scope = 'global'
     OR v_emp_scope NOT LIKE 'emp:%' OR v_src_scope NOT LIKE 'src:%'
     OR v_emp_window IS NULL OR v_src_window IS NULL OR v_global_window IS NULL
  THEN
    RAISE EXCEPTION 'Quota release state transition failed: invalid lease scope keys or window timestamps'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Canonical Lock Order Step A: Lock all quota scope rows FIRST in strict
  --    byte-lexicographical order (COLLATE "C": 'emp:...' -> 'global' -> 'src:...').
  --    Capture ROW_COUNT immediately so no un-locked scope row can be locked after claims.
  -- IMPORTANT: global lock order is NOT proven until every writer/trigger is
  -- inspected. Do not claim a deadlock-free system based on this query alone.
  PERFORM q.scope_key
  FROM private.new_photo_upload_quotas AS q
  WHERE q.scope_key IN (v_emp_scope, v_src_scope, 'global')
  ORDER BY q.scope_key COLLATE "C" ASC
  FOR UPDATE;
  GET DIAGNOSTICS v_locked_scopes = ROW_COUNT;

  -- 4. Canonical Lock Order Step B: Lock the claim row SECOND.
  SELECT *
  INTO v_claim
  FROM private.new_photo_upload_claims AS c
  WHERE c.lease_id = p_lease_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'LEASE_NOT_FOUND');
  END IF;

  -- Verify immutable scope and window attributes did not drift between pre-read and lock.
  IF v_claim.emp_scope IS DISTINCT FROM v_emp_scope
     OR v_claim.src_scope IS DISTINCT FROM v_src_scope
     OR v_claim.emp_window_started_at IS DISTINCT FROM v_emp_window
     OR v_claim.src_window_started_at IS DISTINCT FROM v_src_window
     OR v_claim.global_window_started_at IS DISTINCT FROM v_global_window
  THEN
    RAISE EXCEPTION 'Quota release state transition failed: lease immutable scope/window changed during release'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Idempotency and terminal/non-eligible state handling (never refund counters).
  IF v_claim.status = 'RELEASED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'ALREADY_RELEASED');
  ELSIF v_claim.status = 'FINALIZED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'ALREADY_FINALIZED');
  ELSIF v_claim.status = 'CONSUMED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'ALREADY_CONSUMED');
  ELSIF v_claim.status = 'SUPERSEDED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'LEASE_SUPERSEDED');
  ELSIF v_claim.status = 'EXPIRED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'LEASE_EXPIRED');
  ELSIF v_claim.status IS DISTINCT FROM 'CLAIMED' THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'LEASE_NOT_CLAIMED');
  END IF;

  -- 6. Fail-closed policy for missing quota scope rows on an active CLAIMED lease (Q08).
  --    Because v_locked_scopes was captured at Step 3, we are guaranteed all 3 rows
  --    are already locked in canonical order before the claim lock.
  IF v_locked_scopes <> 3 THEN
    RAISE EXCEPTION 'Quota release state transition failed: lease quota scope missing (% of 3)', v_locked_scopes
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Transition claim from CLAIMED -> RELEASED and attest all returned columns (Q03, Q04).
  UPDATE private.new_photo_upload_claims AS c
  SET status = 'RELEASED',
      released_at = v_now
  WHERE c.lease_id = p_lease_id
    AND c.status = 'CLAIMED'
  RETURNING c.status,
            c.released_at,
            c.emp_scope,
            c.src_scope,
            c.emp_window_started_at,
            c.src_window_started_at,
            c.global_window_started_at
  INTO v_lease_status,
       v_lease_released_at,
       v_ret_emp_scope,
       v_ret_src_scope,
       v_ret_emp_window,
       v_ret_src_window,
       v_ret_global_window;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1
     OR v_lease_status IS DISTINCT FROM 'RELEASED'
     OR v_lease_released_at IS DISTINCT FROM v_now
     OR v_ret_emp_scope IS DISTINCT FROM v_emp_scope
     OR v_ret_src_scope IS DISTINCT FROM v_src_scope
     OR v_ret_emp_window IS DISTINCT FROM v_emp_window
     OR v_ret_src_window IS DISTINCT FROM v_src_window
     OR v_ret_global_window IS DISTINCT FROM v_global_window
  THEN
    RAISE EXCEPTION 'Quota release state transition failed: lease transition did not reach RELEASED'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Iterate over the already-locked quota rows in deterministic COLLATE "C" order.
  --    No FOR UPDATE is needed here because all 3 rows were locked at Step 3.
  FOR v_quota IN
    SELECT q.scope_key, q.attempt_count, q.window_started_at
    FROM private.new_photo_upload_quotas AS q
    WHERE q.scope_key IN (v_emp_scope, v_src_scope, 'global')
    ORDER BY q.scope_key COLLATE "C" ASC
  LOOP
    v_processed_scopes := v_processed_scopes + 1;

    v_expected_window := CASE
      WHEN v_quota.scope_key = v_emp_scope THEN v_emp_window
      WHEN v_quota.scope_key = v_src_scope THEN v_src_window
      ELSE v_global_window
    END;

    -- Policy for expired/rolled-over windows (Q09):
    -- Never decrement a newly rolled-over window for an old lease; record its
    -- current count and window so post-loop verification still guards it.
    IF v_quota.window_started_at IS DISTINCT FROM v_expected_window THEN
      IF v_quota.attempt_count IS NULL OR v_quota.attempt_count < 0 THEN
        RAISE EXCEPTION 'Quota release state transition failed: invalid negative or null count on rolled-over window'
          USING ERRCODE = 'P0001';
      END IF;
      IF v_quota.scope_key = v_emp_scope THEN
        v_exp_emp_count := v_quota.attempt_count;
        v_exp_emp_window := v_quota.window_started_at;
      ELSIF v_quota.scope_key = v_src_scope THEN
        v_exp_src_count := v_quota.attempt_count;
        v_exp_src_window := v_quota.window_started_at;
      ELSE
        v_exp_global_count := v_quota.attempt_count;
        v_exp_global_window := v_quota.window_started_at;
      END IF;
      CONTINUE;
    END IF;

    -- Active matching window: counter must be strictly positive (Q07).
    -- Never mask zero/negative counters with GREATEST(0, attempt_count - 1).
    IF v_quota.attempt_count IS NULL OR v_quota.attempt_count <= 0 THEN
      RAISE EXCEPTION 'Quota release state transition failed: quota count not positive (%) for active lease window', v_quota.attempt_count
        USING ERRCODE = 'P0001';
    END IF;

    v_count_after := NULL;
    v_window_after := NULL;
    v_updated_after := NULL;

    UPDATE private.new_photo_upload_quotas AS q
    SET attempt_count = q.attempt_count - 1,
        updated_at = v_now
    WHERE q.scope_key = v_quota.scope_key
      AND q.window_started_at = v_expected_window
      AND q.attempt_count = v_quota.attempt_count
    RETURNING q.attempt_count, q.window_started_at, q.updated_at
    INTO v_count_after, v_window_after, v_updated_after;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1
       OR v_count_after IS DISTINCT FROM (v_quota.attempt_count - 1)
       OR v_count_after < 0
       OR v_window_after IS DISTINCT FROM v_expected_window
       OR v_updated_after IS DISTINCT FROM v_now
    THEN
      RAISE EXCEPTION 'Quota release state transition failed: quota decrement not committed as expected'
        USING ERRCODE = 'P0001';
    END IF;

    -- Immediate same-row re-read to detect non-deferred AFTER UPDATE trigger tampering.
    SELECT q.attempt_count, q.window_started_at
    INTO v_count_confirmed, v_window_confirmed
    FROM private.new_photo_upload_quotas AS q
    WHERE q.scope_key = v_quota.scope_key;

    IF NOT FOUND
       OR v_count_confirmed IS DISTINCT FROM v_count_after
       OR v_window_confirmed IS DISTINCT FROM v_expected_window
    THEN
      RAISE EXCEPTION 'Quota release state transition failed: quota count changed unexpectedly after UPDATE'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_quota.scope_key = v_emp_scope THEN
      v_exp_emp_count := v_count_after;
      v_exp_emp_window := v_expected_window;
    ELSIF v_quota.scope_key = v_src_scope THEN
      v_exp_src_count := v_count_after;
      v_exp_src_window := v_expected_window;
    ELSE
      v_exp_global_count := v_count_after;
      v_exp_global_window := v_expected_window;
    END IF;
  END LOOP;

  IF v_processed_scopes <> 3 THEN
    RAISE EXCEPTION 'Quota release state transition failed: expected 3 processed quota scopes, got %', v_processed_scopes
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Re-check catalog after updates without SET CONSTRAINTS.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_constraint AS con ON con.oid = t.tgconstraint
    WHERE n.nspname = 'private'
      AND c.relname IN ('new_photo_upload_quotas', 'new_photo_upload_claims')
      AND t.tgenabled <> 'D'
      AND (t.tgdeferrable = true OR COALESCE(con.condeferrable, false) = true)
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relname IN ('new_photo_upload_quotas', 'new_photo_upload_claims')
      AND con.condeferrable
  ) THEN
    RAISE EXCEPTION 'Quota release state transition failed: deferrable trigger or constraint detected after quota loop'
      USING ERRCODE = 'P0001';
  END IF;

  -- 10. Post-loop cross-row verification of ALL THREE quota scopes (Q14b, Q14c, Q14d):
  --     Catches AFTER/DEFERRED triggers on a later scope iteration that mutate
  --     an earlier scope row OR delete a scope row (v_verified_scopes = 3).
  FOR v_quota IN
    SELECT q.scope_key, q.attempt_count, q.window_started_at
    FROM private.new_photo_upload_quotas AS q
    WHERE q.scope_key IN (v_emp_scope, v_src_scope, 'global')
    ORDER BY q.scope_key COLLATE "C" ASC
  LOOP
    v_verified_scopes := v_verified_scopes + 1;
    IF v_quota.scope_key = v_emp_scope THEN
      IF v_quota.attempt_count IS DISTINCT FROM v_exp_emp_count
         OR v_quota.window_started_at IS DISTINCT FROM v_exp_emp_window THEN
        RAISE EXCEPTION 'Quota release state transition failed: emp quota mutated during later statement'
          USING ERRCODE = 'P0001';
      END IF;
    ELSIF v_quota.scope_key = v_src_scope THEN
      IF v_quota.attempt_count IS DISTINCT FROM v_exp_src_count
         OR v_quota.window_started_at IS DISTINCT FROM v_exp_src_window THEN
        RAISE EXCEPTION 'Quota release state transition failed: src quota mutated during later statement'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF v_quota.attempt_count IS DISTINCT FROM v_exp_global_count
         OR v_quota.window_started_at IS DISTINCT FROM v_exp_global_window THEN
        RAISE EXCEPTION 'Quota release state transition failed: global quota mutated during later statement'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END LOOP;

  IF v_verified_scopes <> 3 THEN
    RAISE EXCEPTION 'Quota release state transition failed: quota scope row deleted during decrement (% of 3 remaining)', v_verified_scopes
      USING ERRCODE = 'P0001';
  END IF;

  -- 11. Final post-loop verification of the claim row (Q14a):
  --     Catches any immediate or deferred trigger on private.new_photo_upload_quotas
  --     or private.new_photo_upload_claims that mutated or deleted the lease.
  SELECT c.status,
         c.released_at,
         c.emp_scope,
         c.src_scope,
         c.emp_window_started_at,
         c.src_window_started_at,
         c.global_window_started_at
  INTO v_lease_status,
       v_lease_released_at,
       v_ret_emp_scope,
       v_ret_src_scope,
       v_ret_emp_window,
       v_ret_src_window,
       v_ret_global_window
  FROM private.new_photo_upload_claims AS c
  WHERE c.lease_id = p_lease_id;

  IF NOT FOUND
     OR v_lease_status IS DISTINCT FROM 'RELEASED'
     OR v_lease_released_at IS DISTINCT FROM v_now
     OR v_ret_emp_scope IS DISTINCT FROM v_emp_scope
     OR v_ret_src_scope IS DISTINCT FROM v_src_scope
     OR v_ret_emp_window IS DISTINCT FROM v_emp_window
     OR v_ret_src_window IS DISTINCT FROM v_src_window
     OR v_ret_global_window IS DISTINCT FROM v_global_window
  THEN
    RAISE EXCEPTION 'Quota release state transition failed: lease state changed unexpectedly during quota decrement'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'allowed', true,
    'lease_id', p_lease_id,
    'reason', 'RELEASED'
  );
END;
$function$;

-- Explicit ACL hardening: never rely on default PUBLIC execute privileges.
REVOKE ALL ON FUNCTION public.release_new_photo_upload_quota(uuid) FROM PUBLIC;

DO $acl_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.release_new_photo_upload_quota(uuid) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.release_new_photo_upload_quota(uuid) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.release_new_photo_upload_quota(uuid) TO service_role';
  ELSE
    RAISE EXCEPTION 'ACL guard: service_role role is missing; EXECUTE grant not created' USING ERRCODE = 'P0001';
  END IF;
END;
$acl_guard$;

COMMIT;