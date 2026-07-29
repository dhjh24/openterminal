SHELL := /bin/bash

.PHONY: setup setup-backend setup-frontend test test-backend build build-frontend gate up install keys seed-admin

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

build: build-frontend

build-frontend:
	cd frontend && npm run build

gate: test-backend build-frontend
