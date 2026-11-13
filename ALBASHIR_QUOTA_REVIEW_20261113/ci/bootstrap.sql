-- Synthetic-only PostgreSQL bootstrap. Run only in a fresh disposable database.
-- Column names/types are limited to those referenced by the supplied v6.2 candidate/tests.
-- This is not a production schema snapshot and must not be used for deployment.
\set ON_ERROR_STOP on

DO $roles$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES ('service_role'), ('authenticated'), ('anon')) AS role_names(rolname)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = r.rolname) THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        r.rolname
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = r.rolname
        AND (rolsuper OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    ) THEN
      RAISE EXCEPTION 'unsafe pre-existing synthetic role attributes for %', r.rolname;
    END IF;
  END LOOP;
END;
$roles$;

CREATE SCHEMA private AUTHORIZATION CURRENT_USER;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.new_photo_upload_quotas (
  scope_key text COLLATE "C" PRIMARY KEY,
  attempt_count bigint NOT NULL CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE private.new_photo_upload_claims (
  lease_id uuid PRIMARY KEY,
  emp_scope text COLLATE "C" NOT NULL,
  src_scope text COLLATE "C" NOT NULL,
  emp_window_started_at timestamptz NOT NULL,
  src_window_started_at timestamptz NOT NULL,
  global_window_started_at timestamptz NOT NULL,
  status text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  released_at timestamptz
);

REVOKE ALL ON private.new_photo_upload_quotas, private.new_photo_upload_claims FROM PUBLIC;
GRANT SELECT ON private.new_photo_upload_quotas, private.new_photo_upload_claims TO service_role;
