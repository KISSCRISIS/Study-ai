#!/usr/bin/env python3
"""Build a review-only v6.3 candidate and a separate synthetic test variant.

The locked v6.2 source is never modified. The only source edits are exact,
byte-checked substitutions documented below; the deployment lock is removed
only from ci/generated/ for isolated synthetic testing.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
V6_2 = ROOT / "sql" / "REVIEW_ONLY_release_new_photo_upload_quota_v6_2_LOCAL_CANDIDATE.sql"
V6_3 = ROOT / "sql" / "REVIEW_ONLY_release_new_photo_upload_quota_v6_3_LOCAL_CANDIDATE.sql"
TEST_VARIANT = ROOT / "ci" / "generated" / "release_new_photo_upload_quota_v6_3_TEST_ONLY.sql"
EXPECTED_V6_2_SHA256 = "fcde0f620de2de3b5086f089b814554a06655a651c38ccec0ec83f65e1343164"

DECLARATION_BLOCK = """  v_req_jwt_role text := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  v_active_role text := COALESCE(NULLIF(pg_catalog.current_setting('role', true), 'none'), '');
  v_has_service_role boolean := false;
  v_is_superuser boolean := false;
"""

AUTHORIZATION_BLOCK = """  -- 1. Defense-in-depth authorization check (as supplied in Gemini v6).
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

"""

DEPLOYMENT_LOCK = """DO $deployment_lock$
BEGIN
  RAISE EXCEPTION 'REVIEW ONLY: DO NOT EXECUTE; new-only quota release vNext_FIXED requires full schema, trigger inventory, PG16 container verification, and rollback approval';
END;
$deployment_lock$;

"""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except BaseException:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def safe_write_or_verify(path: Path, expected: bytes) -> None:
    if path.exists():
        actual = path.read_bytes()
        if actual != expected:
            raise SystemExit(f"Refusing to overwrite modified generated file: {path}")
        return
    atomic_write(path, expected)


def derive_v6_3(source: bytes) -> bytes:
    if sha256(source) != EXPECTED_V6_2_SHA256:
        raise SystemExit("v6.2 source fingerprint mismatch; refusing to derive a test variant")
    text = source.decode("utf-8")
    substitutions = [
        ("-- ALBASHIR / Principal PostgreSQL 16 & Concurrency Review Candidate — vNext_FIXED (v6.2 / 2026-11-13)",
         "-- ALBASHIR / Principal PostgreSQL 16 & Concurrency Review Candidate — v6.3 / 2026-11-13"),
        ("-- SOURCE: locally reconstructed from v6 reference plus v6.1 changes supplied in chat.",
         "-- SOURCE: review-only derivative of the local v6.2 candidate; not a verified production definition.\n"
         "-- v6.3 change: caller-controlled GUC values are not used for authorization; EXECUTE ACL is the gate.\n"
         "-- Effective production role memberships and prior ACLs remain BLOCKED pending an authorized catalog snapshot."),
        (DECLARATION_BLOCK, ""),
        (AUTHORIZATION_BLOCK,
         "  -- Authorization is enforced by function EXECUTE privileges, not caller-controlled GUC values.\n\n"),
    ]
    for old, new in substitutions:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"Expected exactly one structural source fragment, found {count}: {old[:72]!r}")
        text = text.replace(old, new, 1)
    if "current_setting('request.jwt.claim.role'" in text or "current_setting('role'" in text:
        raise SystemExit("GUC-based authorization reference remains in derived v6.3; refusing output")
    if text.count("$deployment_lock$") != 2 or "BEGIN;\n" not in text or not text.rstrip().endswith("COMMIT;"):
        raise SystemExit("v6.3 lost its deployment lock or atomic transaction boundaries")
    return text.encode("utf-8")


def derive_test_variant(v6_3: bytes) -> bytes:
    text = v6_3.decode("utf-8")
    if text.count(DEPLOYMENT_LOCK) != 1:
        raise SystemExit("Expected exactly one unchanged deployment-lock block; refusing to unlock source")
    variant = text.replace(DEPLOYMENT_LOCK, "", 1)
    if variant == text or "$deployment_lock$" in variant:
        raise SystemExit("Test-only lock removal was not exact")
    if "CREATE OR REPLACE FUNCTION public.release_new_photo_upload_quota(p_lease_id uuid)" not in variant:
        raise SystemExit("Function definition missing from generated test variant")
    if "REVOKE ALL ON FUNCTION public.release_new_photo_upload_quota(uuid) FROM PUBLIC;" not in variant:
        raise SystemExit("ACL revocation missing from generated test variant")
    if "GRANT EXECUTE ON FUNCTION public.release_new_photo_upload_quota(uuid) TO service_role" not in variant:
        raise SystemExit("ACL grant missing from generated test variant")
    if not variant.startswith("-- ALBASHIR /") or "\nBEGIN;\n" not in variant or not variant.rstrip().endswith("COMMIT;"):
        raise SystemExit("Atomic function/ACL transaction boundaries were not preserved")
    # The generated variant must be reconstructable by adding back only the one locked block.
    if variant.replace("BEGIN;\n\n", "BEGIN;\n\n" + DEPLOYMENT_LOCK, 1) != v6_3.decode("utf-8"):
        raise SystemExit("Generated test variant differs outside the deployment lock")
    return variant.encode("utf-8")


def main() -> None:
    if not V6_2.is_file():
        raise SystemExit(f"Required source file missing: {V6_2}")
    original_bytes = V6_2.read_bytes()
    original_hash_before = sha256(original_bytes)
    v6_3_bytes = derive_v6_3(original_bytes)
    test_bytes = derive_test_variant(v6_3_bytes)
    safe_write_or_verify(V6_3, v6_3_bytes)
    safe_write_or_verify(TEST_VARIANT, test_bytes)
    if sha256(V6_2.read_bytes()) != original_hash_before:
        raise SystemExit("Source fingerprint changed during build; source file must remain untouched")
    print(f"SOURCE_SHA256={original_hash_before}")
    print(f"V6_3_SHA256={sha256(v6_3_bytes)}")
    print(f"TEST_VARIANT_SHA256={sha256(test_bytes)}")
    print(f"CREATED_OR_VERIFIED={V6_3.relative_to(ROOT)}")
    print(f"CREATED_OR_VERIFIED={TEST_VARIANT.relative_to(ROOT)}")
    print("STATUS=STATIC_BUILD_ONLY; PostgreSQL behavior is not verified by this generator")


if __name__ == "__main__":
    main()
