#!/usr/bin/env bash
# =====================================================================
# Container-based pgTAP RLS test harness for the Supabase schema.
# =====================================================================
# Why a throwaway container + raw psql instead of `supabase db reset` / `db test`:
# this harness validates the schema directly against a disposable Postgres
# container, applying every migration in sorted filename order via `psql -f` —
# exactly how these migrations were originally validated, and decoupled from the
# Supabase CLI (prod is deployed via MCP apply_migration, not `db push`). Note:
# migration versions are all unique, so `supabase db reset` works locally too;
# this container path stays the source of truth for the RLS test run.
#
# Pipeline (matches production ordering):
#   shim  -> baseline migration -> grants -> remaining migrations
#         -> helpers -> seed (committed) -> CREATE EXTENSION pgtap -> run tests
#
# Exits non-zero on ANY test failure (CI-friendly).
# =====================================================================
set -euo pipefail

# ---- Locations ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${SUPABASE_DIR}/migrations"
TESTS_DIR="${SCRIPT_DIR}"

# ---- Image selection (with fallback) ----
PRIMARY_IMAGE="public.ecr.aws/supabase/postgres:15.8.1.060"
FALLBACK_IMAGES=(
  "supabase/postgres:15.8.1.060"
  "public.ecr.aws/supabase/postgres:17.6.1.132"
  "supabase/postgres:15"
)

PG_IMAGE=""
pick_image() {
  if docker image inspect "${PRIMARY_IMAGE}" >/dev/null 2>&1; then
    PG_IMAGE="${PRIMARY_IMAGE}"; return
  fi
  for img in "${FALLBACK_IMAGES[@]}"; do
    if docker image inspect "${img}" >/dev/null 2>&1; then
      PG_IMAGE="${img}"; return
    fi
  done
  # Nothing cached: try to pull the primary.
  echo ">> Primary image not cached; attempting to pull ${PRIMARY_IMAGE} ..."
  if docker pull "${PRIMARY_IMAGE}" >/dev/null 2>&1; then
    PG_IMAGE="${PRIMARY_IMAGE}"; return
  fi
  echo "!! Could not find or pull a supabase/postgres image." >&2
  exit 3
}

# ---- Container lifecycle ----
CONTAINER_NAME="sbi_pgtap_$(date +%s)_${RANDOM}"
PG_PASSWORD="postgres"
PG_USER="postgres"
PG_DB="postgres"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# psql inside the container, fail-fast (ON_ERROR_STOP). Used with -c/-f, which do
# NOT need stdin, so we do NOT pass `docker exec -i` — an interactive exec would
# drain the caller's stdin (e.g. the `while read` migration loop's process
# substitution), silently truncating the loop after one iteration.
dpsql() {
  docker exec \
    -e PGPASSWORD="${PG_PASSWORD}" \
    "${CONTAINER_NAME}" \
    psql -v ON_ERROR_STOP=1 --no-psqlrc -U "${PG_USER}" -d "${PG_DB}" "$@"
}

# Copy a host file into the container and apply it with ON_ERROR_STOP.
apply_file() {
  local host_path="$1"
  local base
  base="$(basename "${host_path}")"
  docker cp "${host_path}" "${CONTAINER_NAME}:/tmp/${base}"
  dpsql -f "/tmp/${base}"
}

main() {
  echo "============================================================"
  echo " Supabase pgTAP RLS harness"
  echo "============================================================"

  command -v docker >/dev/null 2>&1 || { echo "!! docker not found on PATH" >&2; exit 2; }
  pick_image
  echo ">> Using image: ${PG_IMAGE}"
  echo ">> Container  : ${CONTAINER_NAME}"

  echo ">> Starting throwaway Postgres container ..."
  # IMPORTANT: the supabase/postgres image runs its own entrypoint init that
  # provisions supabase_admin + the anon/authenticated/service_role roles and the
  # auth/storage/extensions schemas. That init only runs cleanly with the image's
  # default user/db; overriding POSTGRES_USER/POSTGRES_DB or the postgres command
  # makes migrate.sh fail with `role "supabase_admin" does not exist`. So we pass
  # ONLY POSTGRES_PASSWORD and let the image bootstrap itself (user/db = postgres).
  # We intentionally do NOT use --rm so a failed boot leaves logs for the trap to
  # surface; cleanup() removes the container on exit.
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
    "${PG_IMAGE}" >/dev/null

  echo ">> Waiting for Postgres to finish init and stay up ..."
  # The image restarts the server mid-init (initdb -> migrate.sh -> FINAL start),
  # and its healthcheck can flip to "healthy" against the TRANSIENT init server
  # before that final restart. A SELECT succeeding once is therefore not enough —
  # the next statement can hit the restart and drop the connection. We require
  # the postmaster start time (pg_postmaster_start_time) to be STABLE across a
  # few seconds, which only holds once the final server is up for good.
  local ready=0
  local last_start="" cur_start="" stable=0
  for _ in $(seq 1 120); do
    cur_start="$(dpsql -tA -c 'SELECT pg_postmaster_start_time()' 2>/dev/null || echo '')"
    if [[ -n "${cur_start}" ]]; then
      if [[ "${cur_start}" == "${last_start}" ]]; then
        stable=$((stable + 1))
      else
        stable=0
        last_start="${cur_start}"
      fi
      # 3 consecutive identical start times (~3s apart) => final server is stable.
      if [[ "${stable}" -ge 3 ]]; then ready=1; break; fi
    else
      stable=0
    fi
    sleep 1
  done
  if [[ "${ready}" -ne 1 ]]; then
    echo "!! Postgres did not become ready in time." >&2
    docker logs "${CONTAINER_NAME}" 2>&1 | tail -40 >&2
    exit 4
  fi
  echo ">> Postgres is ready."

  # ---- 1. Platform shim (auth/storage/roles/publication) ----
  echo ">> Applying platform shim (_shim.sql) ..."
  apply_file "${TESTS_DIR}/_shim.sql"

  # ---- 2. Migrations in sorted filename order ----
  #    Baseline first, then grants (so the broad grant precedes D2's revoke),
  #    then every remaining migration. Duplicate-timestamp pairs both apply
  #    because we sort by full filename.
  echo ">> Applying migrations (sorted filename order) ..."
  local applied=0
  while IFS= read -r mig; do
    local base; base="$(basename "${mig}")"
    printf '   - %s\n' "${base}"
    apply_file "${mig}" >/dev/null
    applied=$((applied + 1))

    # Immediately after the baseline, apply the production-style table grants so
    # that D2's REVOKE has a table-wide SELECT to act against.
    if [[ "${base}" == 20260101000000_baseline_schema.sql ]]; then
      printf '   - (post-baseline) _grants.sql\n'
      apply_file "${TESTS_DIR}/_grants.sql" >/dev/null
    fi
  done < <(find "${MIGRATIONS_DIR}" -maxdepth 1 -name '*.sql' | LC_ALL=C sort)
  echo ">> Applied ${applied} migration files."

  # ---- 3. Deterministic seed, then test helpers (committed) ----
  #    Seed FIRST: it creates public._test_ids, which the t.id() SQL helper
  #    references in its body (SQL function bodies are validated at CREATE time,
  #    so the table must already exist when _helpers.sql runs).
  echo ">> Seeding fixtures (_seed.sql) ..."
  apply_file "${TESTS_DIR}/_seed.sql" >/dev/null
  echo ">> Installing test helpers (_helpers.sql) ..."
  apply_file "${TESTS_DIR}/_helpers.sql" >/dev/null

  # ---- 4. pgTAP extension ----
  echo ">> Installing pgTAP extension ..."
  dpsql -c 'CREATE EXTENSION IF NOT EXISTS pgtap;' >/dev/null

  # ---- 5. Run the test files ----
  echo "============================================================"
  echo " Running pgTAP tests"
  echo "============================================================"

  # Collect test files (NN_*_test.sql), sorted.
  local test_files=()
  while IFS= read -r f; do test_files+=("${f}"); done \
    < <(find "${TESTS_DIR}" -maxdepth 1 -name '*_test.sql' | LC_ALL=C sort)

  if [[ "${#test_files[@]}" -eq 0 ]]; then
    echo "!! No *_test.sql files found." >&2
    exit 5
  fi

  # Prefer pg_prove (TAP harness) INSIDE the container if present, else fall back
  # to per-file psql with a TAP-failure scan.
  local have_pg_prove=0
  if docker exec "${CONTAINER_NAME}" sh -c 'command -v pg_prove' >/dev/null 2>&1; then
    have_pg_prove=1
  fi

  local rc=0
  if [[ "${have_pg_prove}" -eq 1 ]]; then
    echo ">> Using pg_prove (in-container TAP harness)."
    for f in "${test_files[@]}"; do
      docker cp "${f}" "${CONTAINER_NAME}:/tmp/$(basename "${f}")"
    done
    if ! docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "${CONTAINER_NAME}" \
        pg_prove -U "${PG_USER}" -d "${PG_DB}" --ext .sql \
        $(printf '/tmp/%s ' "$(for f in "${test_files[@]}"; do basename "${f}"; done)"); then
      rc=1
    fi
  else
    echo ">> pg_prove not available; using psql TAP fallback."
    local total_fail=0
    for f in "${test_files[@]}"; do
      local base; base="$(basename "${f}")"
      echo "------------------------------------------------------------"
      echo "# ${base}"
      docker cp "${f}" "${CONTAINER_NAME}:/tmp/${base}"
      # Capture TAP output; ON_ERROR_STOP off so a SQL error surfaces as TAP text
      # rather than aborting the whole run, but we still detect failures below.
      local out
      out="$(docker exec -i -e PGPASSWORD="${PG_PASSWORD}" "${CONTAINER_NAME}" \
              psql --no-psqlrc -t -A -U "${PG_USER}" -d "${PG_DB}" \
              -f "/tmp/${base}" 2>&1 || true)"
      echo "${out}"
      # A pgTAP failure prints lines beginning with "not ok". A hard SQL error
      # (e.g. ERROR:) and TAP plan mismatch diagnostics also count as failures.
      # The plan check matters because psql itself exits zero when finish()
      # reports that a file ran more or fewer assertions than it declared.
      local file_fail
      file_fail="$(printf '%s\n' "${out}" | grep -c -E '^not ok|^ERROR:|psql:.*ERROR|^# Looks like you planned [0-9]+ tests? but ran [0-9]+' || true)"
      if [[ "${file_fail}" -gt 0 ]]; then
        echo "## ${base}: ${file_fail} failing line(s)"
        total_fail=$((total_fail + file_fail))
      fi
    done
    echo "------------------------------------------------------------"
    if [[ "${total_fail}" -gt 0 ]]; then
      echo "RESULT: FAIL (${total_fail} failing assertion/error line(s))"
      rc=1
    else
      echo "RESULT: PASS (all assertions ok)"
    fi
  fi

  echo "============================================================"
  if [[ "${rc}" -eq 0 ]]; then
    echo " GREEN — all pgTAP tests passed."
  else
    echo " RED — one or more pgTAP tests failed."
  fi
  echo "============================================================"
  return "${rc}"
}

main "$@"
