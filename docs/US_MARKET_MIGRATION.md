# U.S. Market Migration

Convert OpenTerminalUI from a mixed India/U.S. terminal into a **U.S.-only** product under `MARKET_PROFILE=US`.

Branch: `feat/us-only-market-profile`

## Affected files (high level)

### Configuration
- `.env.example`, `.env` (local), `docker-compose.yml`
- `backend/config/settings.py`, `backend/config/settings.yaml`, `backend/config/adapters.yaml`
- `backend/config/polling_config.yaml`
- `frontend` Vite env (`VITE_MARKET_PROFILE`)

### Market core
- `backend/shared/market_classifier.py`, `market_calendar.py`, `symbol_resolver.py`
- `backend/adapters/registry.py`, `yahoo.py`, `alpaca.py`, `us_options_adapter.py`
- `backend/main.py`, `backend/api/router.py`, health/metrics routes
- `backend/services/marketdata_hub.py`, `prefetch_worker.py`, `us_tick_stream.py`
- `backend/fno/services/option_chain_fetcher.py`, `greeks_engine.py`

### Frontend surfaces
- `frontend/src/store/settingsStore.ts`, `stockStore.ts`, `types/markets.ts`
- `frontend/src/pages/HomePage.tsx`, `TickerTape.tsx`, `TopBar.tsx`
- `frontend/src/fno/*` (layout, presets, labels)
- Watchlists, screener presets, launchpad, command bar, paper trading, portfolio examples

### India-only (remove after U.S. tests pass)
- Kite/NSE/BSE clients and adapters
- NSE F&O bhavcopy / PCR / instruments loader workers
- India shareholding scrapers, NSE symbol CSVs, India holidays
- `kiteconnect`, `nsepython`, `nsetools`

## Retained U.S. features

Equities, U.S. options, ETFs, futures, crypto, forex, fixed income, portfolio tools, screeners, alerts, backtesting, research, paper trading, AI/agent features, SEC/EDGAR filings, Treasury rates/yield curves, Finnhub live ticks, FMP fundamentals, Yahoo fallback.

## Removal list

| Category | Items |
|----------|--------|
| Exchanges | NSE, BSE, NFO |
| Brokers | Zerodha Kite auth + streaming |
| Indices / symbols | NIFTY, BANKNIFTY, FINNIFTY, SENSEX, RELIANCE defaults, INDIAVIX |
| Currency / locale | INR primary, Asia/Kolkata as product TZ, India country selector |
| Suffixes | `.NS`, `.BO` as default routing |
| Wording | F&O → Options & Futures; CE/PE → Call/Put; LTP → Last; lot size → contract multiplier (U.S. contracts) |
| Deps | kiteconnect, nsepython, nsetools |
| Data | India equity CSVs, India-only fixtures/screenshots where unused |

## Provider map (U.S. profile)

| Need | Primary | Fallback |
|------|---------|----------|
| Live U.S. equity ticks | Finnhub WebSocket | Polling / Yahoo |
| Fundamentals, earnings, profiles, option data | FMP | Yahoo Finance |
| OHLCV / quotes | Yahoo (default adapter) | Alpaca when keyed |
| Filings | Existing SEC/EDGAR | — |
| Rates / yield curves | Existing U.S. Treasury / FRED | Configurable risk-free fallback |
| Options chain + Greeks | `USOptionsAdapter` + local BS (mibian) | Mark calculated vs provider |

**Adapter default under US profile:** Yahoo (not Kite).

**Do not start under `MARKET_PROFILE=US`:** Kite streaming, Zerodha auth, NSE instrument load, NSE F&O refresh, NSE PCR snapshots, NSE corporate-action / India shareholding ingestion, India-specific news jobs.

## Risks

1. **Options quality** — delayed/fallback chains must be labeled; Greeks must never be shown as provider-supplied.
2. **IV unit mismatch** — yfinance decimal IV vs mibian percent; normalize at provider boundary.
3. **Hard-coded 7.1% RFR** — breaks U.S. Greeks; replace with configurable U.S. rate.
4. **Migration compatibility** — do not rewrite Alembic history; use forward migrations only.
5. **Persisted browser settings** — old NSE/INR localStorage must migrate to NASDAQ/USD.
6. **Paid data / keys** — Finnhub/FMP/Alpaca optional; app must degrade cleanly without secrets.
7. **Paper trading** — never submit real broker orders.

## Migration phases

1. **U.S. market configuration** — `MARKET_PROFILE` / `VITE_MARKET_PROFILE`, defaults, exchange allowlist, 400 for India exchanges, settings migration.
2. **U.S. interface conversion** — symbols, labels, pulse, tape, F&O→Options & Futures, presets (SPY-first).
3. **Providers & background services** — Yahoo default, gate India workers, U.S. health metrics, strip India API routes.
4. **Repair U.S. options** — RFR, IV normalization, AMEX/CBOE, OCC ids, data-quality fields, deterministic tests.
5. **Remove India code & deps** — after U.S. suite green; keep shared generic services.
6. **Verification** — compileall, pytest, frontend build/vitest/e2e, `make gate`, README update, draft PR (no merge).

## Test plan

- Fresh users: NASDAQ + USD defaults
- Persisted NSE/INR → NASDAQ/USD migration
- No India country/currency selector in US UI
- Homepage U.S. indices; options workspace starts on SPY
- India exchange/routes → controlled 400 unsupported-market
- Kite/NSE workers never start under US profile
- Finnhub failure falls back cleanly
- Option responses include source, timestamp, delay status, data-quality
- Deterministic BS/IV/Greeks tests; malformed provider data
- No India production imports; no real broker orders
- Gate: `PYTHONPATH=. python -m compileall backend`, `pytest backend/tests -q`, frontend `npm ci && npm run build && npx vitest run && npm run test:e2e`, `make gate`

## Verification results (feat/us-only-market-profile)

| Check | Result |
|-------|--------|
| `compileall backend` | Pass |
| `pytest backend/tests -q` | **704 passed** |
| `npm run build` | Pass |
| `npx vitest run` | **272 passed** (87 files) |
| `npm run test:e2e` | Requires `python` on PATH (use project `.venv`) |
| `make gate` | compileall + pytest + frontend build |

## Remaining limitations

- Options chains may be **delayed** (Yahoo) or key-gated (FMP); Greeks are always **locally calculated**, never presented as provider-supplied.
- Live ticks need `FINNHUB_API_KEY`; without it the app falls back to polling/Yahoo.
- Paper trading is **simulation only** — no live brokerage connectivity or real orders.
- Some UI routes still use `/fno` path prefixes (renamed user-facing to Options & Futures).
- Forex may still list INR as a currency pair (FX coverage, not an India equity market).
- First-release exchange coverage is **NYSE + NASDAQ only** (REST quotes + Finnhub streaming). AMEX/CBOE/CME are not claimed until end-to-end paths exist.
- `data/holidays.json` covers calendar year **2026** (plus early closes); CI/tests fail if the year rolls over without an update.
- Some agent/tool defaults and stress-test fixtures may still mention historical India symbols in non-runtime paths.

## Default symbols (US)

Prefetch defaults: SPY, QQQ, IWM, DIA, AAPL, MSFT, NVDA, AMZN, META, TSLA  
(override with `PREFETCH_SYMBOLS`)

## Supported exchanges (US profile)

**NASDAQ, NYSE** (tested REST + streaming)

## Holiday calendar maintenance

Update `data/holidays.json` before each year:

1. Set `"years": [YYYY]` and NYSE holiday dates.
2. Add `"early_closes": { "YYYY-MM-DD": "13:00", ... }` for early-close sessions.
3. Run `pytest backend/tests/test_market_calendar.py` — `assert_calendar_covers` fails if the current year is missing.

## Defaults

| Setting | Value |
|---------|--------|
| Country | US |
| Currency | USD |
| Exchange | NASDAQ |
| Timezone | America/New_York |
| Options underlier | SPY |
| Risk-free rate | Configurable (`US_RISK_FREE_RATE`; **fallback** 4.5% — not a live Treasury quote) |
| Internal IV format | **Percent** (e.g. `22.5` = 22.5%); Yahoo/FMP decimals converted by provider schema |
| 0DTE time | Fractional year to session close (`America/New_York`) |

## Local CI gate

```bash
make ci-local          # backend tests + frontend build/vitest + docker compose validate
make test-e2e          # Playwright (includes us-market-smoke)
PYTHONPATH=. pytest backend/tests -q
cd frontend && npx vitest run && npm run build
```
