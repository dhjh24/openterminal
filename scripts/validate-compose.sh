#!/usr/bin/env bash
# CI / local validation for Docker Compose isolation rules.
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.yml"
OVERRIDE_FILE="docker-compose.override.yml"
EXAMPLE_ENV=".env.example"
FAIL=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

fail() {
  red "FAIL: $*"
  FAIL=1
}

pass() {
  green "OK: $*"
}

# --- 1. Compose syntax / required variables (via .env.example) -------------
if [[ ! -f "$EXAMPLE_ENV" ]]; then
  fail ".env.example is missing"
else
  # Render with example env so CI has defaults without committing secrets.
  docker compose \
    --env-file "$EXAMPLE_ENV" \
    -f "$COMPOSE_FILE" \
    config >/tmp/compose.base.yml
  pass "docker compose -f $COMPOSE_FILE config (base / production-like)"

  docker compose \
    --env-file "$EXAMPLE_ENV" \
    -f "$COMPOSE_FILE" \
    --profile postgres \
    config >/tmp/compose.postgres.yml
  pass "docker compose --profile postgres config"

  if [[ -f "$OVERRIDE_FILE" ]]; then
    docker compose \
      --env-file "$EXAMPLE_ENV" \
      -f "$COMPOSE_FILE" \
      -f "$OVERRIDE_FILE" \
      --profile postgres \
      config >/tmp/compose.dev.yml
    pass "docker compose with override + postgres config"
  fi
fi

# --- 2. Required isolation markers -----------------------------------------
grep -q '^name:' "$COMPOSE_FILE" || fail "compose file missing top-level name:"
grep -q 'app_network' "$COMPOSE_FILE" || fail "missing private app_network"
grep -q 'COMPOSE_PROJECT_NAME' "$COMPOSE_FILE" || fail "volumes/name should reference COMPOSE_PROJECT_NAME"
pass "project name + private network present"

# --- 3. No hard-coded generic container_name -------------------------------
if grep -nE '^[[:space:]]*container_name:[[:space:]]*(postgres|redis|frontend|backend|api|web)[[:space:]]*$' "$COMPOSE_FILE" "$OVERRIDE_FILE" 2>/dev/null; then
  fail "hard-coded generic container_name found"
else
  if grep -nE '^[[:space:]]*container_name:' "$COMPOSE_FILE" "$OVERRIDE_FILE" 2>/dev/null; then
    fail "container_name present — remove unless there is a proven requirement"
  else
    pass "no container_name entries"
  fi
fi

# --- 4. No external shared networks ----------------------------------------
if grep -nE '^[[:space:]]*external:[[:space:]]*true' "$COMPOSE_FILE" "$OVERRIDE_FILE" 2>/dev/null; then
  fail "external: true network/volume found (undocumented shared resource)"
else
  pass "no external: true resources"
fi

# --- 5. Internal URLs must not use localhost for DB/Redis ------------------
# REDIS_URL is forced in compose; DATABASE_URL default must not point at localhost host ports.
if grep -nE 'REDIS_URL:[[:space:]]*["'\'']?redis://localhost' "$COMPOSE_FILE"; then
  fail "compose REDIS_URL uses localhost (use redis:6379)"
else
  pass "compose REDIS_URL uses Docker service hostname"
fi

if grep -nE '@localhost:(5432|5433|5436|6379|6380|6381)' "$COMPOSE_FILE" "$OVERRIDE_FILE" 2>/dev/null; then
  fail "internal connection string uses localhost + host port"
else
  pass "no localhost host-port DB/Redis URLs in compose"
fi

# --- 6. Host ports come from env vars --------------------------------------
grep -q 'API_PORT' "$COMPOSE_FILE" || fail "API_PORT not referenced in compose"
grep -q 'REDIS_HOST_PORT' "$OVERRIDE_FILE" || fail "REDIS_HOST_PORT not in override"
grep -q 'POSTGRES_HOST_PORT' "$OVERRIDE_FILE" || fail "POSTGRES_HOST_PORT not in override"
pass "host ports are env-driven"

# --- 7. Base compose keeps DB/Redis internal (expose, not publish) ---------
if awk '/^  redis:/{in_redis=1} /^  [a-z]/{if($0 !~ /^  redis:/) in_redis=0} in_redis && /ports:/{found=1} END{exit found?0:1}' "$COMPOSE_FILE"; then
  fail "base compose publishes redis ports — use expose + override instead"
else
  pass "redis is expose-only in base compose"
fi

if awk '/^  postgres:/{in_pg=1} /^  [a-z]/{if($0 !~ /^  postgres:/) in_pg=0} in_pg && /ports:/{found=1} END{exit found?0:1}' "$COMPOSE_FILE"; then
  fail "base compose publishes postgres ports — use expose + override instead"
else
  pass "postgres is expose-only in base compose"
fi

# --- 8. Duplicate host ports inside rendered config ------------------------
if [[ -f /tmp/compose.dev.yml ]]; then
  # Extract published host ports from override-enabled render
  mapfile -t PUBLISHED < <(grep -E 'published:[[:space:]]*"?[0-9]+"?' /tmp/compose.dev.yml \
    | grep -oE '[0-9]+' | sort | uniq -d || true)
  if [[ ${#PUBLISHED[@]} -gt 0 && -n "${PUBLISHED[0]:-}" ]]; then
    fail "duplicate published host ports in project: ${PUBLISHED[*]}"
  else
    pass "no duplicate published host ports"
  fi

  grep -q 'published: "8105"' /tmp/compose.dev.yml || fail "expected default API_PORT 8105"
  grep -q 'published: "6382"' /tmp/compose.dev.yml || fail "expected default REDIS_HOST_PORT 6382"
  grep -q 'published: "5436"' /tmp/compose.dev.yml || fail "expected default POSTGRES_HOST_PORT 5436"
  pass "default host ports match .env.example (8105 / 6382 / 5436)"
fi

# --- 9. Secrets not committed ----------------------------------------------
if [[ -f .env ]]; then
  # .env may exist locally; it must be gitignored
  if git check-ignore -q .env 2>/dev/null || [[ ! -d .git ]]; then
    pass ".env is ignored or repo has no git metadata"
  else
    fail ".env is tracked by git — secrets must not be committed"
  fi
else
  pass "no .env in workspace (CI)"
fi

# Block obvious committed secret files
for f in .env.production .env.local secrets.env credentials.json; do
  if [[ -f "$f" ]] && ! git check-ignore -q "$f" 2>/dev/null; then
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      fail "secret-like file is tracked: $f"
    fi
  fi
done

# --- 10. .env.example documents project identity ---------------------------
grep -q '^COMPOSE_PROJECT_NAME=' "$EXAMPLE_ENV" || fail "COMPOSE_PROJECT_NAME missing from .env.example"
grep -q '^API_PORT=' "$EXAMPLE_ENV" || fail "API_PORT missing from .env.example"
grep -q '^POSTGRES_HOST_PORT=' "$EXAMPLE_ENV" || fail "POSTGRES_HOST_PORT missing from .env.example"
grep -q '^REDIS_HOST_PORT=' "$EXAMPLE_ENV" || fail "REDIS_HOST_PORT missing from .env.example"
pass ".env.example has isolation variables"

if [[ "$FAIL" -ne 0 ]]; then
  red "Compose isolation validation failed"
  exit 1
fi

green "Compose isolation validation passed"
