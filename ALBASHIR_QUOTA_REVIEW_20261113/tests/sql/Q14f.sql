-- ALBASHIR QA Test: Q14f.sql
-- Purpose: Verify that duplicate constraint/trigger names within the same schema (`private`)
--          on unrelated tables are NEVER prematurely fired by `public.release_new_photo_upload_quota(uuid)`.
-- Target: PostgreSQL 16 (Synthetic Isolated QA Environment Only)

BEGIN;

-- 1. Setup synthetic environment if not already present
CREATE SCHEMA IF NOT EXISTS private;

DO $setup_roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END;
$setup_roles$;

GRANT service_role TO CURRENT_USER;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.new_photo_upload_quotas (
  scope_key text PRIMARY KEY COLLATE "C",
  attempt_count bigint NOT NULL CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS private.new_photo_upload_claims (
  lease_id uuid PRIMARY KEY,
  emp_scope text NOT NULL COLLATE "C",
  src_scope text NOT NULL COLLATE "C",
  emp_window_started_at timestamptz NOT NULL,
  src_window_started_at timestamptz NOT NULL,
  global_window_started_at timestamptz NOT NULL,
  status text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz
);

-- 2. Create unrelated sibling table in same private schema with a deferred FK.
DROP TABLE IF EXISTS private.q14f_sibling_ledger CASCADE;
CREATE TABLE private.q14f_sibling_ledger (
  ledger_id int PRIMARY KEY,
  parent_id int NOT NULL
);

CREATE TABLE private.q14f_sibling_parents (
  parent_id int PRIMARY KEY
);

ALTER TABLE private.q14f_sibling_ledger
  ADD CONSTRAINT shared_deferrable_invariant_con
  FOREIGN KEY (parent_id)
  REFERENCES private.q14f_sibling_parents(parent_id)
  DEFERRABLE INITIALLY DEFERRED;

-- A non-deferrable CHECK with the same name on the target table.
ALTER TABLE private.new_photo_upload_quotas
  DROP CONSTRAINT IF EXISTS shared_deferrable_invariant_con;
ALTER TABLE private.new_photo_upload_quotas
  ADD CONSTRAINT shared_deferrable_invariant_con
  CHECK (attempt_count >= 0);

-- 3. Seed valid quota and claim rows.
DELETE FROM private.new_photo_upload_claims WHERE lease_id = '14f00000-0000-4000-8000-00000000014f'::uuid;
DELETE FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14f', 'src:q14f', 'global');

INSERT INTO private.new_photo_upload_quotas (scope_key, attempt_count, window_started_at, updated_at)
VALUES
  ('emp:q14f', 2, '2026-11-13 08:00:00+00'::timestamptz, '2026-11-13 08:00:00+00'::timestamptz),
  ('global',   5, '2026-11-13 08:00:00+00'::timestamptz, '2026-11-13 08:00:00+00'::timestamptz),
  ('src:q14f', 3, '2026-11-13 08:00:00+00'::timestamptz, '2026-11-13 08:00:00+00'::timestamptz);

INSERT INTO private.new_photo_upload_claims (
  lease_id, emp_scope, src_scope,
  emp_window_started_at, src_window_started_at, global_window_started_at,
  status
) VALUES (
  '14f00000-0000-4000-8000-00000000014f'::uuid,
  'emp:q14f', 'src:q14f',
  '2026-11-13 08:00:00+00'::timestamptz,
  '2026-11-13 08:00:00+00'::timestamptz,
  '2026-11-13 08:00:00+00'::timestamptz,
  'CLAIMED'
);

-- 4. Deferred violation in sibling row; premature SET CONSTRAINTS would raise 23503.
INSERT INTO private.q14f_sibling_ledger (ledger_id, parent_id) VALUES (1, 999);

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claim.role" = 'service_role';

DO $verify_q14f$
DECLARE
  v_res jsonb;
  v_status text;
  v_emp_cnt bigint;
  v_src_cnt bigint;
  v_glb_cnt bigint;
BEGIN
  v_res := public.release_new_photo_upload_quota('14f00000-0000-4000-8000-00000000014f'::uuid);

  IF v_res->>'allowed' IS DISTINCT FROM 'true' OR v_res->>'reason' IS DISTINCT FROM 'RELEASED' THEN
    RAISE EXCEPTION 'Q14f FAILED: unexpected response %', v_res;
  END IF;

  SELECT status INTO v_status
  FROM private.new_photo_upload_claims
  WHERE lease_id = '14f00000-0000-4000-8000-00000000014f'::uuid;

  SELECT attempt_count INTO v_emp_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'emp:q14f';
  SELECT attempt_count INTO v_src_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14f';
  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';

  IF v_status IS DISTINCT FROM 'RELEASED'
     OR v_emp_cnt <> 1
     OR v_src_cnt <> 2
     OR v_glb_cnt <> 4
  THEN
    RAISE EXCEPTION 'Q14f FAILED: unexpected post-release state (status=%, emp=%, src=%, global=%)',
      v_status, v_emp_cnt, v_src_cnt, v_glb_cnt;
  END IF;
END;
$verify_q14f$;

RESET ROLE;

-- 5. Satisfy deferred constraint before transaction ends.
INSERT INTO private.q14f_sibling_parents (parent_id) VALUES (999);
SET CONSTRAINTS private.shared_deferrable_invariant_con IMMEDIATE;

ROLLBACK;