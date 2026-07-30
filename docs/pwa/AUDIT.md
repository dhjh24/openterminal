# PWA & mobile-responsive audit (Phase 1 baseline)

Date: 2026-07-29  
Branch: `feat/pwa-mobile-responsive`  
Coordinates with: `fix/runtime-stability-and-deployment` (merged) — does **not** restore unsafe cache-first HTML or API caching.

## Manifest (before → after)

| Field | Before | After |
|---|---|---|
| name / short_name | OpenTerminalUI / OTUI | OpenTerminal / OpenTerminal |
| description | missing | present |
| id / scope | missing | `/` |
| start_url | `/` | `/home` |
| display | standalone | standalone |
| background / theme | `#06080c` | `#06080c` |
| lang / dir | missing | `en-US` / `ltr` |
| categories | missing | finance, business, productivity |
| icons | 192 + 512 only | any + maskable + monochrome |
| shortcuts | missing | Home, Watchlist, Stock Search, Option Chain, News, Alerts |
| screenshots | missing | narrow + wide |
| share_target | absent | still absent (no receiving route) |

## Service worker

| Topic | Before | After |
|---|---|---|
| Registration | `main.tsx` on load with `?v=__GIT_COMMIT__` | unchanged registration; **no auto-reload** |
| Update UX | hard reload on `controllerchange` | **Update available** banner → user reload |
| Cache names | `otui-static-v6-otui-static` (static BUILD_ID) | `otui-shell-${commit}` + shared `otui-assets-v1` |
| HTML / navigate | network-first | network-first (shell only after failure) |
| Hashed assets | network-first, no failed/HTML cache | same; kept across shell activation |
| `/api/*` | not intercepted | not intercepted |
| WebSocket | not intercepted | explicit upgrade skip |
| Offline | shell fallback to index.html | shell fallback to app.html / index.html |

## Icons

| Asset | Size |
|---|---|
| `/icons/icon-192.png` | 192×192 |
| `/icons/icon-512.png` | 512×512 |
| `/icons/icon-maskable-192.png` | 192×192 (padded safe zone) |
| `/icons/icon-maskable-512.png` | 512×512 (padded) |
| `/icons/icon-monochrome-192.png` | 192×192 |
| `/icons/apple-touch-icon.png` | 180×180 |
| `/icons/favicon-16.png` / `32` | 16 / 32 |
| `/favicon.png` | 48×48 (was non-square 273×259) |

## Routes / install risk (baseline)

| Scenario | Risk |
|---|---|
| After install, primary routes | Work if network available; protected routes still need auth token |
| After new deployment | Stale hashed chunks recovered once via `lazyWithRetry` + `ChunkLoadRecovery`; SW no longer auto-reloads without consent |
| Cached market data labeled live | **Fixed** — offline watchlist shows “Snapshot only — not live”; global offline banner; WS not subscribed offline |
| Home mobile bottom nav | **Fixed** — `pb-16` so content is not covered |

## Offline policy

Allowed offline: app shell, navigation, appearance/layout localStorage, labeled watchlist snapshot, docs/help, last-online timestamp.  
Blocked offline: order submission, alert create (server), live badges / connected WS status, silent cached quotes as live.

Banner copy (exact):

```text
Offline — live market data and trading actions are unavailable.
```

## Viewport baselines (100% zoom)

Playwright captures at `/login` (public entry; authenticated primary routes require session):

| Viewport | Result |
|---|---|
| 390×844 | ok — no horizontal overflow |
| 393×852 | ok |
| 412×915 | ok |
| 430×932 | ok |
| 768×1024 | ok |
| 820×1180 | ok |
| 1024×768 | ok |
| 1366×768 | ok |
| 1920×1080 | ok |

Files: `docs/pwa/screenshots/login-*.png`  
Spec: `frontend/tests/e2e/pwa-mobile-responsive.spec.ts`

## HTTP cache headers

- `index.html` / `app.html`: `Cache-Control: no-cache`
- `sw.js` / `manifest.json`: `Cache-Control: no-cache` (added)
- hashed `/assets/*`: `public, max-age=31536000, immutable`
