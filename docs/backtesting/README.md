# Backtesting Blueprint Implementation Status

This folder tracks implementation of the "OpenTerminalUI Pro Backtesting Enhancement Blueprint v1.0".

## Milestones

- [x] M0: Build passes (backend + frontend), existing backtesting flow remains operational.
- [ ] M1: Phase 4A engine foundation complete.
- [ ] M2: Phase 4B visualization suite complete.
- [ ] M3: Phase 4C mosaic workspace complete.
- [ ] M4: Phase 4D advanced research modules complete.

## Progress Snapshot

- Added extended strategy catalog and comparison workflow.
- Added analytics endpoint for drawdown, rolling metrics, distribution, and trade diagnostics.
- Added v1 API compatibility endpoints under `/api/v1/backtest/*`.
- Added deterministic walk-forward, Monte Carlo, and parameter optimization backend modules.
- Added institutional metrics fields to backtest result schema and engine output.

## Canonical API Contract (issue #32)

The frontend and all new code use exactly one job-lifecycle contract:

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| POST | `/api/v1/backtest/jobs` | Submit a backtest job | `{run_id, status}` |
| GET | `/api/v1/backtest/jobs/{run_id}` | Poll job status | `{run_id, status}` |
| GET | `/api/v1/backtest/jobs/{run_id}/result` | Fetch completed result | `{run_id, status, result, logs, error}` |

Submit payload fields:

- `symbol` (required), `asset`, `market` (default `NSE`), `start`, `end`, `limit`
- `timeframe` (default `1d`) — reaches the historical-data service and engine
- `strategy` (default `example:sma_crossover`), `context`, `config`

Status values: `queued`, `running`, `done`, `failed`; unknown runs return HTTP 404.

Supporting endpoints (non-job lifecycle, still live):

- `GET /api/v1/backtest/presets` — strategy catalog (`{items: [...]}`)
- `GET /api/backtests/{run_id}/analytics` — post-run analytics
- `GET /api/backtests/{run_id}/robustness` — permutation/window robustness

## Compatibility Rules

- **Legacy job endpoints are DEPRECATED** (marked in OpenAPI) and kept only as
  aliases: `POST /api/backtests`, `GET /api/backtests/{run_id}/status`,
  `GET /api/backtests/{run_id}/result`, `POST /api/v1/backtest/submit`,
  `GET /api/v1/backtest/status/{run_id}`, `GET /api/v1/backtest/result/{run_id}`.
  New code must use the canonical `/api/v1/backtest/jobs*` contract.
- `POST /api/backtest/run` (momentum-rotation backtest) is a separate feature
  and unchanged.
- Frontend/backend contract tests live in
  `backend/tests/test_backtests_contract.py` and
  `frontend/src/__tests__/backtestApi.test.ts`.
