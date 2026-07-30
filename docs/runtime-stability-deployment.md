# Runtime stability & deployment notes

## Root causes

1. **TradingChart cleanup** called `chart.remove()` then `removeSeries()` on comparison series; `useIndicators` was registered before chart init so its cleanup also ran after destroy → `Value is undefined`.
2. **Chart dimensions** created Lightweight Charts with `clientWidth`/`clientHeight` of 0 in flex/hidden panels → `width(-1)/height(-1)` warnings.
3. **Stale chunks** `lazyWithRetry` retried the same missing hashed URL; SW cache-first + missing HTML `no-cache` left tabs on deleted assets after deploy.
4. **WebSocket** quotes manager lacked ping/pong timeout, market normalization for US tokens, and clear close logging; default chart market was `IN`.
5. **Notifications** `TerminalShell` polled `fetchUnreadCount` without auth gating → uncaught 401s for guests/expired sessions.
6. **Heatmap copy** still referenced Kite/India F&O under the US market profile.

## Deploy guidance (ports unchanged)

- App host port **8005**, Redis **6380**, Postgres **5433** (see `docker-compose.yml`).
- Prefer rebuilding the image fully before switching traffic; do not delete the active frontend `dist` until the new build is ready.
- HTML (`index.html` / `app.html`) is served with `Cache-Control: no-cache`.
- Hashed `/assets/*` are served with `Cache-Control: public, max-age=31536000, immutable`.
- Service worker is network-first for navigation/HTML and JS chunks; failed/HTML responses are never cached as scripts.
- Stale tabs recover once per build via `sessionStorage` key `otui:chunk-recovery` (tied to `__GIT_COMMIT__`).

## Test commands

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd frontend && npm test -- --run
cd .. && .venv/bin/pytest backend/tests/test_spa_cache_headers.py backend/tests/test_ws/ -q
docker compose config
npx playwright test frontend/tests/e2e/runtime-stability.spec.ts
```
