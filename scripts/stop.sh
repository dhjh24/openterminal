#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

echo "Stopping Compose project: $(compose_project_name) (volumes preserved)"
compose_cmd down

echo
echo "Data volumes were kept. To wipe this project's data only:"
echo "  docker compose --project-name $(compose_project_name) down --volumes"
echo "WARNING: --volumes permanently deletes this project's database and cache."
