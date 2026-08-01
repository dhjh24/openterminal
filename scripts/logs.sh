#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=lib/compose-env.sh
source "$SCRIPT_DIR/lib/compose-env.sh"

load_dotenv

# Pass through args, e.g. ./scripts/logs.sh -f backend
compose_cmd logs "$@"
