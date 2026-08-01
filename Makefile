SHELL := /bin/bash

.PHONY: setup setup-backend setup-frontend test test-backend test-frontend test-e2e build build-frontend gate lint-backend docker-validate security-scan ci-local docker-up docker-down docker-status docker-logs check-ports

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
	./scripts/validate-compose.sh

check-ports:
	./scripts/check-ports.sh

docker-up:
	./scripts/start.sh

docker-down:
	./scripts/stop.sh

docker-status:
	./scripts/status.sh

docker-logs:
	./scripts/logs.sh -f

security-scan:
	python -m pip install -q pip-audit && pip-audit -r backend/requirements.txt || true
	cd frontend && npm audit --omit=dev || true

# Local mirror of required CI gates (backend + frontend build/vitest + compose).
gate: test-backend build-frontend test-frontend

ci-local: gate docker-validate
	@echo "CI local gate complete. Run 'make test-e2e' for Playwright smoke."
