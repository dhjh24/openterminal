# Database Migration

## Overview

The backend supports async SQLAlchemy engine creation and Alembic migrations,
with SQLite as the local default and remote PostgreSQL (e.g. Neon) for
deployments.

## Environment

- `DATABASE_URL` (app connections)
  - SQLite default: `sqlite+aiosqlite:///./data/openterminal.db`
  - PostgreSQL: `postgresql://user:***@host:5432/dbname?sslmode=require`
    (auto-converted to `postgresql+asyncpg://`; the async driver strips
    `sslmode`/`channel_binding` query params and maps them to the `ssl`
    connect arg — see `backend/db/base.py::_asyncpg_safe_url`)
- `DATABASE_DIRECT_URL` (migrations only)
  - Direct/pooled-endpoint URL; `backend/alembic/env.py` prefers it over
    `DATABASE_URL` so DDL runs against the direct endpoint. Falls back to
    `DATABASE_URL` when unset.

## Files

- `backend/db/base.py`: async engine factory + URL normalization
- `backend/db/session.py`: async session factory + dependency
- `backend/alembic.ini`: Alembic config
- `backend/alembic/env.py`: async migration environment (direct URL)
- `backend/alembic/versions/0001_initial.py`: initial schema migration

## Run Migrations

```bash
alembic -c backend/alembic.ini upgrade head
```

Set `DATABASE_DIRECT_URL` (or `DATABASE_URL`) in the environment to migrate
against remote PostgreSQL; unset, it migrates the local SQLite file.

## Docker

Container startup runs migrations automatically via `backend/entrypoint.sh`
before launching the API (`SKIP_MIGRATIONS=1` disables that). Deployments
point `DATABASE_URL` / `DATABASE_DIRECT_URL` / `REDIS_URL` at remote
infrastructure via the deployment environment (see `.env.example`).

## Notes

- BRIN indexes are created on PostgreSQL for selected timestamp-like columns in initial migration.
- Existing legacy sync ORM continues to function; async DB session infrastructure is available for phased adoption.
