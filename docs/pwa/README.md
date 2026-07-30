# PWA install & safe offline behavior

OpenTerminal is installable as a Progressive Web App (standalone) on desktop, Android, and iOS/iPadOS (Add to Home Screen).

## Install

- Manifest: `/manifest.json` (`id` `/`, `start_url` `/home`, `display` `standalone`)
- Icons: `/icons/*` including maskable and Apple touch icon
- Shortcuts: Home, Watchlist, Stock Search, Option Chain, News, Alerts
- Install prompt: `InstallPromptBanner` (Chromium `beforeinstallprompt`)

## Updates

- New service workers wait for user confirmation.
- UI shows **Update available** (`UpdateAvailableBanner`).
- Reload applies `SKIP_WAITING` once; dismissal is session-scoped to avoid prompt spam.
- Stale lazy chunks still use build-scoped `lazyWithRetry` recovery (see `docs/runtime-stability-deployment.md`).

## Caching (safe)

| Resource | Strategy |
|---|---|
| HTML / navigation | Network-first; shell cache only on network failure |
| Hashed JS/CSS under `/assets/` | Network-first; long-lived `otui-assets-v1` cache; never cache failed or HTML-as-JS |
| Application shell icons/manifest precache | Versioned `otui-shell-<gitsha>` |
| `/api/*`, `/health`, `/auth*` | Never intercepted by the service worker |
| WebSocket | Never intercepted |

Shell activation deletes prior `otui-shell-*` caches only, so a second tab on an older build keeps hashed assets until it reloads.

## Offline

Persistent banner:

```text
Offline — live market data and trading actions are unavailable.
```

Also shows last successful connection timestamp when known.

Offline may show a **labeled** watchlist snapshot (`otui:watchlist-snapshot:v1`). Quotes in that snapshot are never presented as live.

Offline blocks:

- paper order submission (`assertOnlineForAction`)
- alert creation requiring server persistence
- live WS subscriptions on the watchlist

## Mobile

- `MobileBottomNav`: Home, Watch, Stocks, Options, News, + More (Alerts, Portfolio, Screener)
- Home content uses `pb-16` so the bottom nav does not cover the page
- Workspace control bar scrolls horizontally and collapses dense controls below `md`/`lg`

## Related

- Runtime stability / stale chunks: `docs/runtime-stability-deployment.md`
- Phase 1 audit notes: `docs/pwa/AUDIT.md`
