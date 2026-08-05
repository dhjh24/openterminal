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
- `allow_synthetic` (default `false`) — explicit demo/test toggle for synthetic
  data; production runs fail closed when the requested market has no bars

Status values: `queued`, `running`, `done`, `failed`; unknown runs return HTTP 404.

Supporting endpoints (non-job lifecycle, still live):

- `GET /api/v1/backtest/presets` — strategy catalog (`{items: [...]}`)
- `GET /api/backtests/{run_id}/analytics` — post-run analytics
- `GET /api/backtests/{run_id}/robustness` — permutation/window robustness

## Data Integrity Rules (issue #32 Phase 2)

- **Fail closed on missing data**: a job fetches ONLY the requested market. The
  old silent exchange fallback (NASDAQ → NSE/BSE and reverse) is removed, and
  the data service's synthetic-bar fallback is disabled for backtest jobs.
  No bars → the run fails with an explicit error; it never evaluates on data
  from a different exchange.
- **Synthetic data requires a toggle**: `allow_synthetic=true` generates bars
  and marks the result with `synthetic_data_used: true`, a persistent
  `SYNTHETIC DATA — NOT FOR EVALUATION` warning (banner in the UI, warning in
  `warnings[]`, note in `logs`), and `data_provenance.synthetic_used: true`.
- **Applied configuration echo**: every visible execution setting is declared
  on `BacktestConfig` and applied by the engine. The completed result carries:
  - `applied_config` — commission/slippage model/spread/impact/volume cap/
    position/allow_short/timeframe/fill delay/data version/adjusted
  - `costs_breakdown` — commission_paid, slippage_paid, spread_paid,
    impact_paid, total_paid
  - `data_provenance` — requested vs used market, provider, bar count,
    date range, data version, adjusted flag, synthetic flag
  - `unsupported_settings` — anything requested but not applicable
- The UI's nested `execution_profile` (`commission_bps`, `slippage_model`,
  `slippage_bps`, `spread_bps`, `market_impact_bps`, `volume_cap_pct`) is
  flattened into engine config, so spread/impact/volume-cap now affect fills.
  Legacy `fee_bps` remains as an alias for `commission_bps`.

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
