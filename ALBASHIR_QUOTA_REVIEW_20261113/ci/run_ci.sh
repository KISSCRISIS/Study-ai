#!/usr/bin/env bash
# ALBASHIR review CI: only an ephemeral local Docker container, with NO networking.
# This script never connects to a host PostgreSQL server and never issues DROP DATABASE.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
CI_DIR="$ROOT/ci"
LOG_DIR="$CI_DIR/logs"
mkdir -p "$LOG_DIR"
: > "$LOG_DIR/RESULTS.tsv"

fail() { printf 'BLOCKED\t%s\n' "$*" | tee -a "$LOG_DIR/RESULTS.tsv" >&2; exit 3; }
[[ "${GITHUB_ACTIONS:-}" == true ]] || fail 'GitHub Actions runner required; local database execution disabled'
[[ "${GITHUB_REPOSITORY:-}" == KISSCRISIS/Study-ai ]] || fail 'unexpected GitHub repository'
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]] || fail 'missing GitHub run ID'
[[ "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]] || fail 'missing GitHub run attempt'
command -v docker >/dev/null 2>&1 || fail 'Docker is not installed'
command -v python3 >/dev/null 2>&1 || fail 'Python is not installed'
command -v node >/dev/null 2>&1 || fail 'Node is not installed'

# Reject inherited connections/secrets even though database traffic uses docker exec only.
blocked_env=(DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL SUPABASE_DB_URL SUPABASE_URL PGHOST PGHOSTADDR PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGOPTIONS PGTARGETSESSIONATTRS PGSSLCERT PGSSLKEY PGSSLROOTCERT)
for name in "${blocked_env[@]}"; do
  [[ -z "${!name:-}" ]] || fail "unexpected inherited database variable: $name"
done

python3 "$CI_DIR/build_test_variant.py" > "$LOG_DIR/build_test_variant.log" 2>&1 || fail 'test variant generation failed'
python3 "$CI_DIR/fix_tests.py" > "$LOG_DIR/fix_tests.log" 2>&1 || fail 'Q14f/g/h derivation failed'
node --check "$CI_DIR/verifier/VERIFY_REPAIRS_STATIC.cjs" > "$LOG_DIR/node_check.log" 2>&1 || fail 'verifier JavaScript syntax check failed'
node "$CI_DIR/verifier/VERIFY_REPAIRS_STATIC.cjs" --self-test > "$LOG_DIR/static_negative_tests.log" 2>&1 || fail 'negative mutation checks failed'
node "$CI_DIR/verifier/VERIFY_REPAIRS_STATIC.cjs" > "$LOG_DIR/static_verifier.log" 2>&1 || fail 'static verifier failed'
[[ -x "$CI_DIR/check_isolation.sh" ]] || fail 'check_isolation.sh must have Git executable mode 100755'
printf 'PASS\tcheck_isolation.sh executable mode verified\n' | tee -a "$LOG_DIR/RESULTS.tsv"
printf 'PASS\tstatic verifier and mutation checks (not a PG16 result)\n' | tee -a "$LOG_DIR/RESULTS.tsv"

CID=""
cleanup() {
  # Only remove the one container created by THIS run. Never touch databases.
  if [[ -n "$CID" ]]; then
    docker rm -f "$CID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

NAME="albashir-ci-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
CID=$(docker run --detach --network none --name "$NAME" \
  --label 'org.openai.albashir.purpose=synthetic-review-only' \
  --label "org.openai.albashir.run=${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
  --env POSTGRES_PASSWORD=local_synthetic_pg16_only \
  postgres:16-alpine) || fail 'could not create the isolated PostgreSQL 16 container'
export ALBASHIR_CREATED_CONTAINER_ID="$CID"

ready=0
for _ in $(seq 1 45); do
  if docker exec "$CID" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || fail 'ephemeral PostgreSQL did not become ready'

"$CI_DIR/check_isolation.sh" "$CID" postgres > "$LOG_DIR/isolation_postgres.log" 2>&1 || fail 'ephemeral server identity verification failed'

run_sql() {
  local db="$1" file="$2" log="$3"
  docker exec -i "$CID" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$db" \
    < "$file" > "$log" 2>&1
}

CASES=(Q14f Q14f_target_guards Q14g Q14h Q14i_roles Q14j_idempotency Q14k_jwt_spoof)
for case_name in "${CASES[@]}"; do
  test_file="$CI_DIR/tests/${case_name}.sql"
  [[ -f "$test_file" ]] || fail "missing test file: ${case_name}"
  db="review_${case_name,,}"
  # New databases within this run's freshly created, network-isolated container.
  # CREATE only. No destructive cleanup or host database connection.
  docker exec "$CID" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "CREATE DATABASE \"${db}\";" > "$LOG_DIR/${case_name}_create.log" 2>&1 \
    || fail "database creation failed for ${case_name}"
  "$CI_DIR/check_isolation.sh" "$CID" "$db" > "$LOG_DIR/${case_name}_isolation.log" 2>&1 \
    || fail "unexpected container/database identity for ${case_name}"
  run_sql "$db" "$CI_DIR/bootstrap.sql" "$LOG_DIR/${case_name}_bootstrap.log" \
    || fail "${case_name} bootstrap FAILED"
  run_sql "$db" "$CI_DIR/fixtures/seed.sql" "$LOG_DIR/${case_name}_seed.log" \
    || fail "${case_name} fixture FAILED"
  run_sql "$db" "$CI_DIR/generated/release_new_photo_upload_quota_v6_3_TEST_ONLY.sql" \
    "$LOG_DIR/${case_name}_apply.log" || fail "${case_name} function test variant FAILED"
  if run_sql "$db" "$test_file" "$LOG_DIR/${case_name}.log"; then
    printf 'PASS\t%s PostgreSQL 16; see ci/logs/%s.log\n' "$case_name" "$case_name" | tee -a "$LOG_DIR/RESULTS.tsv"
  else
    printf 'FAIL\t%s PostgreSQL 16; see ci/logs/%s.log\n' "$case_name" "$case_name" | tee -a "$LOG_DIR/RESULTS.tsv" >&2
    tail -n 40 "$LOG_DIR/${case_name}.log" >&2 || true
    exit 1
  fi
done

# Q14l is deliberately separate: a same-lease concurrency race, not a proof
# of global deadlock freedom across missing CLAIM/FINALIZE/CLEANUP implementations.
CONCURRENT_DB=review_q14l
if ! docker exec "$CID" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "CREATE DATABASE \"$CONCURRENT_DB\";" > "$LOG_DIR/Q14l_create.log" 2>&1; then
  fail 'Q14l database creation failed'
fi
"$CI_DIR/check_isolation.sh" "$CID" "$CONCURRENT_DB" > "$LOG_DIR/Q14l_isolation.log" 2>&1 || fail 'Q14l database identity failed'
run_sql "$CONCURRENT_DB" "$CI_DIR/bootstrap.sql" "$LOG_DIR/Q14l_bootstrap.log" || fail 'Q14l bootstrap failed'
run_sql "$CONCURRENT_DB" "$CI_DIR/fixtures/seed.sql" "$LOG_DIR/Q14l_seed.log" || fail 'Q14l seed failed'
run_sql "$CONCURRENT_DB" "$CI_DIR/generated/release_new_photo_upload_quota_v6_3_TEST_ONLY.sql" "$LOG_DIR/Q14l_apply.log" || fail 'Q14l function apply failed'
if python3 "$CI_DIR/tests/Q14l_concurrency.py" "$CID" "$CONCURRENT_DB" > "$LOG_DIR/Q14l.log" 2>&1; then
  printf 'PASS\tQ14l same-lease concurrency; see ci/logs/Q14l.log\n' | tee -a "$LOG_DIR/RESULTS.tsv"
else
  printf 'FAIL\tQ14l same-lease concurrency; see ci/logs/Q14l.log\n' | tee -a "$LOG_DIR/RESULTS.tsv" >&2
  tail -n 40 "$LOG_DIR/Q14l.log" >&2 || true
  exit 1
fi
printf 'PASS\tall configured synthetic PostgreSQL 16 tests passed (not Production approval)\n' | tee -a "$LOG_DIR/RESULTS.tsv"
