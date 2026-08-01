#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

POSTGRES=0
DETACH=1
API_PORT_ARG=""

require_arg_value() {
  if [ -z "${2:-}" ]; then
    echo "Missing value for $1"
    exit 1
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --redis)
      # Redis is always part of the stack; flag kept for backward compatibility.
      shift
      ;;
    --postgres)
      POSTGRES=1
      shift
      ;;
    --no-detach)
      DETACH=0
      shift
      ;;
    --port)
      require_arg_value "$1" "${2:-}"
      API_PORT_ARG="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: ./scripts/docker-up.sh [--postgres] [--no-detach] [--port <host_port>]"
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Required command not found: docker"
  exit 1
fi

docker compose version >/dev/null
docker info >/dev/null

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# Optional CLI port override writes into the process environment for Compose.
if [ -n "$API_PORT_ARG" ]; then
  case "$API_PORT_ARG" in
    ''|*[!0-9]*)
      echo "Invalid port: $API_PORT_ARG"
      exit 1
      ;;
  esac
  export API_PORT="$API_PORT_ARG"
  export WEB_PORT="$API_PORT_ARG"
  export APP_PORT="$API_PORT_ARG"
fi

# Resolve project name from .env without sourcing the whole file.
PROJECT_NAME="openterminalui"
if grep -q '^COMPOSE_PROJECT_NAME=' .env 2>/dev/null; then
  PROJECT_NAME="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env | head -n1)"
elif grep -q '^PROJECT_NAME=' .env 2>/dev/null; then
  PROJECT_NAME="$(sed -n 's/^PROJECT_NAME=//p' .env | head -n1)"
fi
PROJECT_NAME="${PROJECT_NAME:-openterminalui}"

if [ -x ./scripts/check-ports.sh ]; then
  if [ "$POSTGRES" -eq 1 ]; then
    USE_POSTGRES=1 ./scripts/check-ports.sh --postgres
  else
    ./scripts/check-ports.sh
  fi
fi

set -- compose --project-name "$PROJECT_NAME" --env-file .env
if [ "$POSTGRES" -eq 1 ]; then
  set -- "$@" --profile postgres
fi
set -- "$@" up --build
if [ "$DETACH" -eq 1 ]; then
  set -- "$@" -d
fi

echo "Running: docker $*"
docker "$@"

HOST_PORT="${API_PORT:-}"
if [ -z "$HOST_PORT" ]; then
  HOST_PORT="$(sed -n 's/^API_PORT=//p' .env | head -n1)"
fi
HOST_PORT="${HOST_PORT:-8105}"

echo
echo "Open http://127.0.0.1:$HOST_PORT"
echo "API docs: http://127.0.0.1:$HOST_PORT/docs"
echo "Project: $PROJECT_NAME"
