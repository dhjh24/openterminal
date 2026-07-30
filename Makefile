SHELL := /bin/bash

.PHONY: setup setup-backend setup-frontend test test-backend test-frontend test-e2e build build-frontend gate lint-backend docker-validate security-scan ci-local

# One-command install + launch (auto-detects Docker vs local).
install up:
	./install.sh

# Interactive wizard to add/update all API keys in the single .env.
keys:
	./scripts/setup-keys.sh

# Seed the initial admin account from BOOTSTRAP_ADMIN_* in .env (idempotent).
seed-admin:
	PYTHONPATH=. python scripts/seed_admin.py

setup: setup-backend setup-frontend

setup-backend:
	cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && pip install pytest

setup-frontend:
	cd frontend && npm install

test: test-backend

test-backend:
	PYTHONPATH=. python -m compileall backend && PYTHONPATH=. pytest backend/tests -q

test-frontend:
	cd frontend && npx vitest run

test-e2e:
	cd frontend && npm run test:e2e

lint-backend:
	PYTHONPATH=. python -m compileall backend

build: build-frontend

build-frontend:
	cd frontend && npm run build

docker-validate:
	docker compose -f docker-compose.yml config >/tmp/compose.default.yml
	grep -q 'published: "8005"' /tmp/compose.default.yml
	grep -q 'published: "6380"' /tmp/compose.default.yml
	docker compose --profile postgres -f docker-compose.yml config >/tmp/compose.postgres.yml
	grep -q 'published: "5433"' /tmp/compose.postgres.yml
	@echo "Compose port mappings OK: app 8005, Redis 6380, Postgres 5433"

security-scan:
	python -m pip install -q pip-audit && pip-audit -r backend/requirements.txt || true
	cd frontend && npm audit --omit=dev || true

# Local mirror of required CI gates (backend + frontend build/vitest + compose).
gate: test-backend build-frontend test-frontend

ci-local: gate docker-validate
	@echo "CI local gate complete. Run 'make test-e2e' for Playwright smoke."
