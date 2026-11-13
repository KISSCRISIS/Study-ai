-- Synthetic fixed fixture used only by ci/tests/Q14j_idempotency.sql.
-- Each test runs in its own newly created database; other tests use disjoint IDs/scopes.
\set ON_ERROR_STOP on

INSERT INTO private.new_photo_upload_quotas
  (scope_key, attempt_count, window_started_at, updated_at)
VALUES
  ('emp:q14j', 2, '2026-11-13 11:00:00+00'::timestamptz, '2026-11-13 11:00:00+00'::timestamptz),
  ('global',   5, '2026-11-13 11:00:00+00'::timestamptz, '2026-11-13 11:00:00+00'::timestamptz),
  ('src:q14j', 3, '2026-11-13 11:00:00+00'::timestamptz, '2026-11-13 11:00:00+00'::timestamptz);

INSERT INTO private.new_photo_upload_claims
  (lease_id, emp_scope, src_scope, emp_window_started_at, src_window_started_at,
   global_window_started_at, status)
VALUES
  ('14a00000-0000-4000-8000-00000000014a'::uuid,
   'emp:q14j', 'src:q14j',
   '2026-11-13 11:00:00+00'::timestamptz,
   '2026-11-13 11:00:00+00'::timestamptz,
   '2026-11-13 11:00:00+00'::timestamptz,
   'CLAIMED');
