#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

API_PORT_VAL="${API_PORT:-8105}"

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
    | grep -E "([^0-9]|^)${port}->|0\\.\\.0\\.0\\.0:${port}|:::${port}" >/dev/null 2>&1
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

# PostgreSQL and Redis are remote (Neon / Redis VM) — no host ports to check.
echo "Database and Redis use remote infrastructure (no local host ports)."

if [[ "$conflicts" -ne 0 ]]; then
  echo
  echo "Resolve port conflicts in .env, then re-run ./scripts/check-ports.sh"
  exit 1
fi

echo
echo "All checked host ports are free."
