-- ALBASHIR QA Test: Q14g.sql
-- Preserve caller dynamic DEFERRED and IMMEDIATE modes.
-- Target: PostgreSQL 16 synthetic only.

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

DROP TABLE IF EXISTS private.q14g_caller_state_test CASCADE;
DROP TABLE IF EXISTS private.q14g_caller_parent CASCADE;

CREATE TABLE private.q14g_caller_parent (
  id int PRIMARY KEY
);

CREATE TABLE private.q14g_caller_state_test (
  id int PRIMARY KEY,
  imm_to_def_ref int,
  def_to_imm_ref int,
  CONSTRAINT con_init_immediate_made_deferred
    FOREIGN KEY (imm_to_def_ref) REFERENCES private.q14g_caller_parent(id)
    DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT con_init_deferred_made_immediate
    FOREIGN KEY (def_to_imm_ref) REFERENCES private.q14g_caller_parent(id)
    DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO private.q14g_caller_parent (id) VALUES (100);

SET CONSTRAINTS private.con_init_immediate_made_deferred DEFERRED;
SET CONSTRAINTS private.con_init_deferred_made_immediate IMMEDIATE;

INSERT INTO private.q14g_caller_state_test (id, imm_to_def_ref, def_to_imm_ref)
VALUES (1, 777, 100);

DELETE FROM private.new_photo_upload_claims WHERE lease_id = '14700000-0000-4000-8000-000000000147'::uuid;
DELETE FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14g', 'src:q14g', 'global');

INSERT INTO private.new_photo_upload_quotas (scope_key, attempt_count, window_started_at, updated_at)
VALUES
  ('emp:q14g', 1, '2026-11-13 09:00:00+00'::timestamptz, '2026-11-13 09:00:00+00'::timestamptz),
  ('global',   2, '2026-11-13 09:00:00+00'::timestamptz, '2026-11-13 09:00:00+00'::timestamptz),
  ('src:q14g', 1, '2026-11-13 09:00:00+00'::timestamptz, '2026-11-13 09:00:00+00'::timestamptz);

INSERT INTO private.new_photo_upload_claims (
  lease_id, emp_scope, src_scope,
  emp_window_started_at, src_window_started_at, global_window_started_at,
  status
) VALUES (
  '14700000-0000-4000-8000-000000000147'::uuid,
  'emp:q14g', 'src:q14g',
  '2026-11-13 09:00:00+00'::timestamptz,
  '2026-11-13 09:00:00+00'::timestamptz,
  '2026-11-13 09:00:00+00'::timestamptz,
  'CLAIMED'
);

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claim.role" = 'service_role';

DO $verify_q14g_release$
DECLARE
  v_res jsonb;
BEGIN
  v_res := public.release_new_photo_upload_quota('14700000-0000-4000-8000-000000000147'::uuid);
  IF v_res->>'allowed' IS DISTINCT FROM 'true' OR v_res->>'reason' IS DISTINCT FROM 'RELEASED' THEN
    RAISE EXCEPTION 'Q14g FAILED during release call: %', v_res;
  END IF;
END;
$verify_q14g_release$;

RESET ROLE;

INSERT INTO private.q14g_caller_state_test (id, imm_to_def_ref, def_to_imm_ref)
VALUES (2, 888, 100);

DO $verify_q14g_modes$
DECLARE
  v_caught_immediate_fk boolean := false;
BEGIN
  BEGIN
    INSERT INTO private.q14g_caller_state_test (id, imm_to_def_ref, def_to_imm_ref)
    VALUES (3, 100, 999);
  EXCEPTION
    WHEN foreign_key_violation THEN
      v_caught_immediate_fk := true;
  END;

  IF NOT v_caught_immediate_fk THEN
    RAISE EXCEPTION 'Q14g FAILED: con_init_deferred_made_immediate was reverted to DEFERRED instead of staying IMMEDIATE';
  END IF;
END;
$verify_q14g_modes$;

INSERT INTO private.q14g_caller_parent (id) VALUES (777), (888);

ROLLBACK;