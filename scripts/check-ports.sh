#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

API_PORT_VAL="${API_PORT:-8105}"
REDIS_PORT_VAL="${REDIS_HOST_PORT:-6382}"
POSTGRES_PORT_VAL="${POSTGRES_HOST_PORT:-5436}"

# Only check ports that this stack will publish.
# Postgres host port is checked when the postgres profile is requested or already configured.
CHECK_POSTGRES=0
if [[ "${1:-}" == "--postgres" ]] || [[ "${USE_POSTGRES:-0}" == "1" ]]; then
  CHECK_POSTGRES=1
fi
if docker compose ls --format json 2>/dev/null | grep -q "\"Name\":\"$(compose_project_name)\"" \
  && compose_cmd ps --services 2>/dev/null | grep -qx postgres; then
  CHECK_POSTGRES=1
fi

conflicts=0

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port"
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return $?
  fi
  # Fallback: try binding via Python
  python3 - "$port" <<'PY' 2>/dev/null
import socket, sys
port = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(("0.0.0.0", port))
except OSError:
    sys.exit(0)  # in use
else:
    s.close()
    sys.exit(1)  # free
PY
}

describe_listener() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" 2>/dev/null | tail -n +2 || true
  fi
  if command -v docker >/dev/null 2>&1; then
    docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null \
      | grep -E "([^0-9]|^)${port}->|:${port}-|0\\.0\\.0\\.0:${port}|:::${port}" || true
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null || true
  fi
}

suggest_port() {
  local start="$1"
  local candidate="$start"
  local i
  for i in $(seq 0 50); do
    candidate=$((start + i))
    if ! port_in_use "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "$((start + 100))"
}

# Skip conflict if our own Compose project already owns the port.
owned_by_this_project() {
  local port="$1"
  local project
  project="$(compose_project_name)"
  docker ps --filter "label=com.docker.compose.project=${project}" \
    --format '{{.Ports}}' 2>/dev/null \
    | grep -E "([^0-9]|^)${port}->|0\\.0\\.0\\.0:${port}|:::${port}" >/dev/null 2>&1
}

report_conflict() {
  local port="$1" env_var="$2"
  local suggested
  suggested="$(suggest_port $((port + 1)))"
  echo
  echo "Port ${port} is already in use."
  echo "Change ${env_var} in .env."
  echo "Suggested available port: ${suggested}."
  echo "Listener details:"
  describe_listener "$port" | sed 's/^/  /'
  conflicts=1
}

check_port() {
  local port="$1" env_var="$2"
  if owned_by_this_project "$port"; then
    echo "Port ${port} (${env_var}): in use by this project — OK"
    return 0
  fi
  if port_in_use "$port"; then
    report_conflict "$port" "$env_var"
  else
    echo "Port ${port} (${env_var}): available"
  fi
}

echo "Checking host ports for project $(compose_project_name)..."
check_port "$API_PORT_VAL" "API_PORT"
# Redis host publish comes from docker-compose.override.yml (dev default).
check_port "$REDIS_PORT_VAL" "REDIS_HOST_PORT"
if [[ "$CHECK_POSTGRES" -eq 1 ]]; then
  check_port "$POSTGRES_PORT_VAL" "POSTGRES_HOST_PORT"
else
  echo "Port ${POSTGRES_PORT_VAL} (POSTGRES_HOST_PORT): skipped (postgres profile not enabled)"
fi

# Duplicate host ports within this project's .env
declare -A seen=()
for pair in \
  "API_PORT:${API_PORT_VAL}" \
  "REDIS_HOST_PORT:${REDIS_PORT_VAL}" \
  "POSTGRES_HOST_PORT:${POSTGRES_PORT_VAL}"; do
  key="${pair%%:*}"
  val="${pair#*:}"
  if [[ -n "${seen[$val]:-}" ]]; then
    echo
    echo "Duplicate host port ${val} configured for ${seen[$val]} and ${key}."
    echo "Each published service needs a unique host port in .env."
    conflicts=1
  else
    seen[$val]="$key"
  fi
done

if [[ "$conflicts" -ne 0 ]]; then
  echo
  echo "Resolve port conflicts in .env, then re-run ./scripts/check-ports.sh"
  exit 1
fi

echo
echo "All checked host ports are free."
