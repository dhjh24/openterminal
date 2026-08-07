# Neon + Remote Redis migration notes

## Summary
- The application now prefers `DATABASE_URL` for pooled application traffic and `DATABASE_DIRECT_URL` for migrations.
- The backend uses a shared Redis client builder so all Redis consumers can use the same remote configuration.
- Docker Compose no longer depends on local Postgres or Redis services; those are removed from the deployment topology.

## Required environment variables
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `REDIS_URL`

## Rollback
1. Restore the previous environment variables.
2. Re-enable the archived local PostgreSQL and Redis services.
3. Restart the application services.
4. Verify health and data consistency before resuming writes.

## Verification commands
- `pytest -q backend/tests/test_db_base_url.py backend/tests/test_cache_integrity.py`
- `./scripts/validate-compose.sh`
