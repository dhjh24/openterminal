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

## Execution Integrity Rules (issue #32 Phase 3)

- **No same-bar fills**: close-derived signals execute at the NEXT tradable
  bar by default (`fill_delay_bars: 1`). Daily fills at the next close;
  intraday fills at the next bar's open. Result metadata states
  `signal_timing: "bar_close"`, `fill_timing: "next_bar"` (or `"same_bar"`
  when `fill_delay_bars: 0` is explicitly requested).
- **Direction-aware trade accounting**: the engine emits a normalized
  `closed_trades` ledger covering LONG (BUY→SELL) and SHORT (SELL→BUY) round
  trips — direction, entry/exit time and price, quantity, gross P/L,
  commission/slippage/spread+impact costs, net P/L, holding period. All trade
  metrics (win rate, avg win/loss, profit factor, loss streaks, AM/PM win
  rates, trades/day) derive from this ledger, so shorts are counted.

## Validation Integrity Rules (issue #32 Phase 4)

- **Real out-of-sample walk-forward**: `POST /api/v1/backtest/validate/walkforward`
  rebuilds the original job request (symbol/market/strategy/context/config)
  and, per fold, FITS/SELECTS parameters on the training slice only, then
  RERUNS the strategy on the unseen test slice. Response:
  `{validation: {windows: [...], summary: {avg_train_sharpe, avg_test_sharpe,
  degradation}, method: "train_fit_then_unseen_test"}}`. The legacy
  equity-curve splitter is kept as a deprecated helper only.
- **Real parameter grids**: the optimizer and walk-forward receive each
  strategy's actual context parameters (e.g. `short_window`/`long_window`),
  never generic `p1`/`p2`. The UI derives a ±20% grid around the selected
  model's defaults.
- **Measured sensitivity only**: if the optimizer returns zero trials, the
  sensitivity panel is empty — the UI never fabricates a matrix from base
  Sharpe.
- **Derived experiments are labeled as proxies**: the depth-derived 3D
  surface tab is titled "3D Surface (Proxy)"; order-book and implied-volatility
  panels are not surfaced (no Level 2 / options-chain source data for a
  backtest).

## Results UX & Accessibility (issue #32 Phase 5)

- **Trust header**: completed runs show a "Run Provenance" panel above the
  fold — status (incl. synthetic flag), provider + market, dataset version +
  adjusted flag, date coverage + bar count, signal/fill timing, applied
  transaction-cost total, closed-trade count, and the reproducible run ID.
- **Failed state**: no valid-looking metrics — a "No valid result" panel with
  a plain explanation, Retry, and Copy diagnostics actions; the performance
  panel renders dashes.
- **Setup clutter reduced**: model parameters are editable beside the model
  selector; the SMA 20/50 model shows SMA 20 + SMA 50 (no stray RSI); the
  indicator catalog sits under a collapsed "Advanced Chart Tools" section;
  the raw dataset UUID is replaced by a readable label with a details
  disclosure; bps fields are explained with an estimated one-way / round-trip
  cost; walk-forward + sensitivity moved behind a collapsed "Advanced
  Analysis" section.
- **Accessibility**: accessible names on timeframe/chart-type selectors,
  decorative tab icons marked aria-hidden (fixes "CMPCompare"/"3D3D Surface"
  duplicated names), 44px minimum touch targets on tab buttons, `role="alert"`
  on failure/error announcements, keyboard-focusable scrollable regions, and
  axe audits (no serious/critical) for setup, running, failed, and completed
  states in `frontend/tests/e2e/backtesting-states-a11y.spec.ts`.

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
