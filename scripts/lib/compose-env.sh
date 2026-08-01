#!/usr/bin/env bash
# Shared helpers for Compose lifecycle scripts.
# shellcheck shell=bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_PROJECT_NAME="openterminalui"

# Load KEY=VALUE pairs from .env without executing shell metacharacters.
load_dotenv() {
  local env_file="${1:-$ROOT_DIR/.env}"
  [[ -f "$env_file" ]] || return 0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # Strip matching single/double quotes
    if [[ "$value" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done < "$env_file"
}

compose_project_name() {
  echo "${COMPOSE_PROJECT_NAME:-${PROJECT_NAME:-$DEFAULT_PROJECT_NAME}}"
}

compose_cmd() {
  local project
  project="$(compose_project_name)"
  if [[ -f "$ROOT_DIR/.env" ]]; then
    docker compose --project-name "$project" --env-file "$ROOT_DIR/.env" "$@"
  else
    docker compose --project-name "$project" "$@"
  fi
}
