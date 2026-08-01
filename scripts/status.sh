#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

PROJECT="$(compose_project_name)"
echo "Compose project: $PROJECT"
echo

compose_cmd ps
echo

echo "Health (docker):"
compose_cmd ps --format 'table {{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Ports}}' || true
echo

API_PORT_VAL="${API_PORT:-8105}"
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 3 "http://127.0.0.1:${API_PORT_VAL}/health" >/dev/null 2>&1; then
    echo "HTTP /health on :${API_PORT_VAL}: OK"
  else
    echo "HTTP /health on :${API_PORT_VAL}: not reachable"
  fi
fi
