#!/usr/bin/env bash
# Validate the precise Docker container created by THIS CI run and its DB.
set -Eeuo pipefail
fail() { printf 'BLOCKED: %s\n' "$*" >&2; exit 3; }
[[ $# -eq 2 ]] || fail 'usage: check_isolation.sh <created-container-id> <expected-db>'
CID="$1"; DB="$2"
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_REPOSITORY:-}" == 'KISSCRISIS/Study-ai' ]] || fail 'not in expected GitHub Actions repository'
[[ -n "${ALBASHIR_CREATED_CONTAINER_ID:-}" && "$CID" == "$ALBASHIR_CREATED_CONTAINER_ID" ]] || fail 'container identity differs from created container'
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]] || fail 'invalid run identity'
[[ "$DB" =~ ^(postgres|review_q14f|review_q14f_target_guards|review_q14g|review_q14h|review_q14i_roles|review_q14j_idempotency|review_q14k_jwt_spoof|review_q14l)$ ]] || fail 'unexpected synthetic database name'
command -v docker >/dev/null 2>&1 || fail 'docker unavailable'

MODE=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$CID") || fail 'container inspection failed'
[[ "$MODE" == none ]] || fail "container is networked (mode=$MODE)"
LABEL=$(docker inspect --format '{{index .Config.Labels "org.openai.albashir.run"}}' "$CID") || fail 'container has no run label'
[[ "$LABEL" == "${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" ]] || fail 'container run-label mismatch'
PURPOSE=$(docker inspect --format '{{index .Config.Labels "org.openai.albashir.purpose"}}' "$CID") || fail 'container purpose label unavailable'
[[ "$PURPOSE" == synthetic-review-only ]] || fail 'container purpose mismatch'
PORTS=$(docker port "$CID" 2>&1) && [[ -z "$PORTS" ]] || fail 'PostgreSQL container exposes a host port'

RESULT=$(docker exec "$CID" psql -h 127.0.0.1 -X -A -t -F '|' -v ON_ERROR_STOP=1 -U postgres -d "$DB" \
  -c "SELECT current_database(), current_setting('server_version_num'), session_user, current_setting('data_directory')") || fail 'database/container probe failed'
IFS='|' read -r ACTUAL_DB VERSION ROLE DATA_DIR <<< "$RESULT"
[[ "$ACTUAL_DB" == "$DB" ]] || fail 'connected to unexpected database'
[[ "$VERSION" =~ ^[0-9]+$ && "$VERSION" -ge 160000 && "$VERSION" -lt 170000 ]] || fail 'not PostgreSQL 16'
[[ "$ROLE" == postgres ]] || fail 'unexpected database role'
[[ "$DATA_DIR" == /var/lib/postgresql/data ]] || fail 'unexpected data directory'
printf 'ISOLATED container=%s database=%s postgres=%s network=none host_ports=none\n' "${CID:0:12}" "$DB" "$VERSION"
