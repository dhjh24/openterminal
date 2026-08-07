#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created .env from .env.example"
  load_dotenv
fi

"$SCRIPT_DIR/check-ports.sh"

# PostgreSQL and Redis are remote (Neon / Redis VM) — no local services.
echo "Starting Compose project: $(compose_project_name)"
compose_cmd up -d --build

echo
echo "App:     ${APP_URL:-http://localhost:${API_PORT:-8105}}"
echo "API docs:${API_PUBLIC_URL:-http://localhost:${API_PORT:-8105}}/docs"
echo "Status:  ./scripts/status.sh"
echo "Logs:    ./scripts/logs.sh"
