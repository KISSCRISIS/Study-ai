-- ALBASHIR: REVIEW-ONLY CATALOG INVENTORY; READ-ONLY, NOT A MIGRATION.
-- Run only in an expressly approved environment using a least-privileged read-only connection.
-- DO NOT connect to Production or Staging unless the owner specifically authorizes a read-only metadata collection.
-- Results contain FUNCTION SOURCE, which may include sensitive code/constants: treat as confidential.
-- This script reads pg_catalog metadata only; it never selects employee/claim/quota rows.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

-- A. Functions whose names suggest any quota/photo/attestation operation.
-- Manually expand the inventory if any caller or helper function is missing.
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    p.oid::pg_catalog.regprocedure::text AS signature,
    p.prokind AS routine_kind,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
    p.prosecdef AS is_security_definer,
    p.proconfig AS function_settings,
    p.proacl AS explicit_acl,
    pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5,
    pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prokind IN ('f', 'p')
  AND p.proname ~* '(new_photo|photo_upload|quota|attest|finalize|supersede|cleanup)'
ORDER BY n.nspname, p.proname, p.oid::pg_catalog.regprocedure::text;

-- B. Function ACLs including implicit defaults; keep grantor/grantee information for rollback.
SELECT
    p.oid::pg_catalog.regprocedure::text AS signature,
    pg_catalog.pg_get_userbyid(a.grantor) AS grantor_name,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee_name,
    a.privilege_type,
    a.is_grantable
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
    pg_catalog.coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
) AS a
WHERE n.nspname IN ('public', 'private')
  AND p.prokind IN ('f', 'p')
  AND p.proname ~* '(new_photo|photo_upload|quota|attest|finalize|supersede|cleanup)'
ORDER BY signature, grantee_name, a.privilege_type, grantor_name;

-- C. All triggers, including system-created ones, on both target tables.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    t.tgisinternal AS is_internal,
    t.tgenabled AS enabled_mode,
    t.tgdeferrable AS deferrable,
    t.tginitdeferred AS initially_deferred,
    pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition,
    t.tgfoid::pg_catalog.regprocedure::text AS trigger_function_signature,
    pg_catalog.pg_get_functiondef(t.tgfoid) AS trigger_function_definition
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'private'
  AND c.relname IN ('new_photo_upload_quotas', 'new_photo_upload_claims')
ORDER BY c.relname, t.tgname;

-- D. Constraint inventory: SET CONSTRAINTS ALL IMMEDIATE in candidate SQL can affect
-- any deferred constraint in the caller's transaction, not just these two tables.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    con.condeferrable,
    con.condeferred,
    pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'private')
  AND con.condeferrable
ORDER BY n.nspname, c.relname, con.conname;

ROLLBACK;