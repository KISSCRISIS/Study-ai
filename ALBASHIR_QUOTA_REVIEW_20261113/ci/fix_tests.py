#!/usr/bin/env python3
"""Create corrected, review-only copies of Q14f/g/h from the locked references.

Every replacement has an expected count. Any source drift fails closed; the
reference tests are never overwritten.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tests" / "sql"
OUT = ROOT / "ci" / "tests"
EXPECTED_SOURCE_SHA256 = {
    "Q14f.sql": "862c0c4a4b49a67dd82fa48e5386f9aecde47a5c2249a484b12a6f31cc4bf29f",
    "Q14g.sql": "045de3a471eb8faa716a16e6f23412488898802d4b11288177d6cab204af8c7c",
    "Q14h.sql": "49489dd3192ce4a964e5c20a49d02515c7ae1ef3dc83af5be9676e7e2a2b2b34",
}


def read_reference(name: str) -> str:
    raw = (SOURCE / name).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED_SOURCE_SHA256[name]:
        raise SystemExit(f"{name}: reference fingerprint mismatch; refusing to generate a corrected copy")
    return raw.decode("utf-8")


def replace_exact(text: str, old: str, new: str, expected: int = 1, label: str = "replacement") -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} match(es), found {count}")
    return text.replace(old, new)


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    except BaseException:
        try:
            os.unlink(name)
        except FileNotFoundError:
            pass
        raise


def fix_collations(text: str) -> str:
    text = replace_exact(text, 'scope_key text PRIMARY KEY COLLATE "C"',
                         'scope_key text COLLATE "C" PRIMARY KEY', expected=1, label="scope_key COLLATE order")
    text = replace_exact(text, 'emp_scope text NOT NULL COLLATE "C"',
                         'emp_scope text COLLATE "C" NOT NULL', expected=1, label="emp_scope COLLATE order")
    text = replace_exact(text, 'src_scope text NOT NULL COLLATE "C"',
                         'src_scope text COLLATE "C" NOT NULL', expected=1, label="src_scope COLLATE order")
    return text


def add_test_select_grants(text: str) -> str:
    anchor = "  released_at timestamptz\n);"
    replacement = anchor + "\n\nGRANT SELECT ON private.new_photo_upload_quotas, private.new_photo_upload_claims TO service_role;"
    return replace_exact(text, anchor, replacement, label="test-only SELECT grants")


def fix_q14f() -> str:
    text = read_reference("Q14f.sql")
    text = fix_collations(text)
    text = add_test_select_grants(text)
    text = replace_exact(text, 'SET LOCAL "request.jwt.claim.role" = \'service_role\';\n', "", label="Q14f remove unnecessary JWT GUC")
    text = replace_exact(text, "  v_glb_cnt bigint;", "  v_glb_cnt bigint;\n  v_rows bigint;\n  v_claim_found boolean := false;", label="Q14f declarations")
    anchor = "  WHERE lease_id = '14f00000-0000-4000-8000-00000000014f'::uuid;\n\n  SELECT attempt_count INTO v_emp_cnt"
    replacement = "  WHERE lease_id = '14f00000-0000-4000-8000-00000000014f'::uuid;\n  v_claim_found := FOUND;\n\n  SELECT attempt_count INTO v_emp_cnt"
    text = replace_exact(text, anchor, replacement, label="Q14f claim existence capture")
    anchor = "  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';\n\n  IF v_status IS DISTINCT FROM 'RELEASED'"
    replacement = "  SELECT attempt_count INTO v_glb_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'global';\n  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14f', 'src:q14f', 'global');\n\n  IF NOT v_claim_found\n     OR v_rows IS DISTINCT FROM 3\n     OR v_status IS DISTINCT FROM 'RELEASED'"
    text = replace_exact(text, anchor, replacement, label="Q14f row existence assertions")
    text = replace_exact(text, "v_emp_cnt <> 1", "v_emp_cnt IS DISTINCT FROM 1", label="Q14f employee counter")
    text = replace_exact(text, "v_src_cnt <> 2", "v_src_cnt IS DISTINCT FROM 2", label="Q14f source counter")
    text = replace_exact(text, "v_glb_cnt <> 4", "v_glb_cnt IS DISTINCT FROM 4", label="Q14f global counter")
    text = replace_exact(text, "SET CONSTRAINTS private.shared_deferrable_invariant_con IMMEDIATE;\n", "", label="Q14f ambiguous SET CONSTRAINTS removal")
    return text


def fix_q14g() -> str:
    text = read_reference("Q14g.sql")
    text = fix_collations(text)
    text = add_test_select_grants(text)
    text = replace_exact(text, 'SET LOCAL "request.jwt.claim.role" = \'service_role\';\n', "", label="Q14g remove unnecessary JWT GUC")
    # Keep the behavioral probes: an invalid insert after the call must remain
    # deferred, while a second invalid insert must fail immediately with 23503.
    text = replace_exact(text, "-- Preserve caller dynamic DEFERRED and IMMEDIATE modes.",
                         "-- Preserve and behaviorally measure caller dynamic DEFERRED and IMMEDIATE modes.", label="Q14g purpose")
    text = replace_exact(text, "  v_caught_immediate_fk boolean := false;",
                         "  v_caught_immediate_fk boolean := false;\n  v_sqlstate text;", label="Q14g diagnostics")
    text = replace_exact(text, "  EXCEPTION\n    WHEN foreign_key_violation THEN\n      v_caught_immediate_fk := true;",
                         "  EXCEPTION\n    WHEN SQLSTATE '23503' THEN\n      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;\n      v_caught_immediate_fk := (v_sqlstate = '23503');", label="Q14g precise SQLSTATE")
    return text


def fix_q14h() -> str:
    text = read_reference("Q14h.sql")
    text = fix_collations(text)
    text = add_test_select_grants(text)
    text = replace_exact(text, 'SET LOCAL "request.jwt.claim.role" = \'service_role\';\n', "", expected=2, label="Q14h remove unnecessary JWT GUC")
    text = replace_exact(text, "  v_status text;\n  v_released_at timestamptz;\n  v_emp_cnt bigint;",
                         "  v_status text;\n  v_released_at timestamptz;\n  v_claim_found boolean := false;\n  v_rows bigint;\n  v_emp_cnt bigint;", expected=2, label="Q14h declarations")
    old_catch = """  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
      IF v_sqlstate = 'P0001' THEN
        v_failed_as_expected := true;
      ELSE
        RAISE EXCEPTION 'Q14h FAILED: unexpected SQLSTATE % (%)', v_sqlstate, v_sqlerrm;
      END IF;
  END;"""
    new_catch = """  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_sqlerrm = MESSAGE_TEXT;
      IF position('quota count not positive' IN lower(v_sqlerrm)) = 0 THEN
        RAISE EXCEPTION 'Q14h FAILED: P0001 was not the intended zero third-scope counter failure: %', v_sqlerrm;
      END IF;
      v_failed_as_expected := true;
  END;"""
    text = replace_exact(text, old_catch, new_catch, label="Q14h exact expected error")
    # Capture whether the claim SELECT found a row before later SELECTs overwrite FOUND.
    claim_anchor = "  WHERE lease_id = '14800000-0000-4000-8000-000000000148'::uuid;"
    text = replace_exact(text, claim_anchor, claim_anchor + "\n  v_claim_found := FOUND;", expected=2, label="Q14h claim existence capture")
    # Add an explicit three-row check before each state assertion.
    counters = "  SELECT attempt_count INTO v_src_cnt FROM private.new_photo_upload_quotas WHERE scope_key = 'src:q14h';\n\n"
    counter_check = counters + "  SELECT count(*) INTO v_rows FROM private.new_photo_upload_quotas WHERE scope_key IN ('emp:q14h', 'src:q14h', 'global');\n\n"
    text = replace_exact(text, counters, counter_check, expected=3, label="Q14h quota row existence")
    # Null-safe numeric comparisons; a missing row can no longer slip through an IF NULL.
    for variable, value, count in (("v_emp_cnt", "3", 1), ("v_glb_cnt", "7", 1), ("v_src_cnt", "0", 1),
                                   ("v_emp_cnt", "2", 2), ("v_glb_cnt", "6", 2), ("v_src_cnt", "3", 2)):
        text = replace_exact(text, f"{variable} <> {value}", f"{variable} IS DISTINCT FROM {value}",
                             expected=count, label=f"Q14h {variable}={value}")
    text = replace_exact(text, "IF v_status IS DISTINCT FROM 'CLAIMED'\n     OR v_released_at IS NOT NULL",
                         "IF NOT v_claim_found\n     OR v_rows IS DISTINCT FROM 3\n     OR v_status IS DISTINCT FROM 'CLAIMED'\n     OR v_released_at IS NOT NULL", label="Q14h rollback existence/null assertions")
    text = replace_exact(text, "IF v_status IS DISTINCT FROM 'RELEASED'\n     OR v_released_at IS NULL",
                         "IF NOT v_claim_found\n     OR v_rows IS DISTINCT FROM 3\n     OR v_status IS DISTINCT FROM 'RELEASED'\n     OR v_released_at IS NULL", label="Q14h retry existence/null assertions")
    text = replace_exact(text, "IF v_emp_cnt IS DISTINCT FROM 2 OR v_glb_cnt IS DISTINCT FROM 6 OR v_src_cnt IS DISTINCT FROM 3 THEN",
                         "IF v_rows IS DISTINCT FROM 3\n     OR v_emp_cnt IS DISTINCT FROM 2\n     OR v_glb_cnt IS DISTINCT FROM 6\n     OR v_src_cnt IS DISTINCT FROM 3 THEN", label="Q14h idempotent row existence")
    return text


def main() -> None:
    outputs = {
        "Q14f.sql": fix_q14f(),
        "Q14g.sql": fix_q14g(),
        "Q14h.sql": fix_q14h(),
    }
    for name, content in outputs.items():
        atomic_write(OUT / name, content)
        print(f"WROTE={OUT / name}")
    print("STATUS=GENERATED_REVIEW_ONLY_COPIES; originals unchanged; PostgreSQL execution not implied")


if __name__ == "__main__":
    main()
