# ALBASHIR — PostgreSQL 16 synthetic CI (review only)

**Deployment status: NO-GO.** This is a disposable, synthetic test harness. It does not authorize deploying v6.2 or v6.3 to Supabase, Staging, or Production.

## Source and guards

- `sql/REVIEW_ONLY_release_new_photo_upload_quota_v6_2_LOCAL_CANDIDATE.sql` is a byte-checked, locked source; never modified by this CI.
- `sql/REVIEW_ONLY_release_new_photo_upload_quota_v6_3_LOCAL_CANDIDATE.sql` is a **locked, unapproved review candidate**. Its changed authorization model (EXECUTE ACL-only vs v6.2's internal check) is a **security blocker** pending an authorized inventory of effective production privileges/role memberships. Passing synthetic tests **does not approve** that change.
- `ci/build_test_variant.py` creates a deploy-lock-free variant **only** at `ci/generated/` on the runner, with exact input fingerprint checks; its output is **not tracked** or published.
- Original `tests/sql/Q14f.sql`, `Q14g.sql`, and `Q14h.sql` remain untouched; `ci/fix_tests.py` generates corrected copies in `ci/tests/` using source fingerprint checks.

## Execution isolation

`ci/run_ci.sh` intentionally **refuses manual/local execution**. It is for GitHub Actions in `KISSCRISIS/Study-ai` only, and it:

1. Checks required CI context; rejects inherited database connection variables.
2. Generates the derived SQL and runs static verification/negative mutation checks.
3. Creates one Docker container from `postgres:16-alpine` with **`--network none`**, no published ports and a per-run identity label.
4. Accesses PostgreSQL **only by `docker exec ... psql` over the internal Unix socket**, never by a host port or environment connection string.
5. Checks the exact created container identity, network mode, labels, PostgreSQL 16 version and DB name.
6. Creates separate synthetic databases inside that new container for Q14f, Q14f target guards, Q14g, Q14h, Q14i, Q14j, Q14k, and Q14l concurrency.
7. **Never executes `DROP DATABASE`**; on exit it removes **only the container ID created by this run**, and Docker discards its anonymous data volume according to container lifecycle (container and volume are unshared disposable test assets).

The disposable database names and inputs are not derived from employee or production data. All tests are expected to be reproducible, but **none should be called PASS until real GitHub Actions logs confirm this**.

## GitHub Actions

Workflow file lives at **repository root** `.github/workflows/pg16-review.yml`, not inside the ALBASHIR folder. It runs on pushes and pull requests scoped to the review branch and folder. It uses `contents: read`, checkout without persistent credentials, no real database secrets, and uploads synthetic log artifacts only.

## Results and limitations

Local static tests: PASS (Python/Node/Bash/YAML; no SQL engine).
PostgreSQL 16 tests: **NOT RUN until workflow completes**.
Full-system deadlock freedom and actual CLAIM/FINALIZE/CONSUME/SUPERSEDE/CLEANUP workflows: **BLOCKED** until original functions are available. Q14l covers only simultaneous RELEASE on the same lease.

The original locked SQL is **never a deployment artifact** and the generated test variant must never be manually applied outside the disposable CI container.
