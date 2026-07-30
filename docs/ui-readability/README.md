# UI Readability Cleanup

Before/after screenshots and audit notes for the `feat/ui-readability-cleanup` branch.

## Capture script

From repo root (app must be reachable; JWT is injected client-side):

```bash
# Before (Docker production build on :8005)
CAPTURE_BASE_URL=http://127.0.0.1:8005 \
CAPTURE_OUT=docs/ui-readability/before \
CAPTURE_PHASE=before \
node scripts/capture-ui-readability.mjs

# After (Vite with VITE_E2E_AUTO_LOGIN=1 on :5173)
CAPTURE_BASE_URL=http://127.0.0.1:5173 \
CAPTURE_OUT=docs/ui-readability/after \
CAPTURE_PHASE=after \
node scripts/capture-ui-readability.mjs
```

Viewports: `1920×1080`, `1440×900`, `1366×768`, `1024×768`, `390×844` at 100% zoom.

Routes: home, stock detail, chart workstation, option chain, greeks, options flow, F&O heatmap, market heatmap, screener, watchlist, news, alerts, portfolio, risk, settings.

## Playwright visual checks

```bash
cd frontend
npx playwright test ui-readability-screenshots --project=chromium
```

Threshold: `maxDiffPixelRatio: 0.04`. Re-baseline after intentional token/chrome changes.

## Defaults after this change

| Preference | Default |
|---|---|
| Density | Comfortable |
| Contrast | Standard |
| Data font | Monospace |
| Decorative effects (scanlines/vignette/WebGL) | Off |
| Reduced motion | Off (also honors `prefers-reduced-motion`) |
| Chart text size | Medium |

## Known limitations

- Some secondary screens still use local formatters; migrate gradually to `lib/format.ts` + `NumericValue` / `ChangeValue`.
- Dense option chains on very narrow widths still scroll horizontally by design; primary price/strike columns stay visible.
- Playwright snapshot baselines must be generated once in CI/local with `--update-snapshots`.
- Not every historical `text-[10px]` call site across the entire app was rewritten; chrome, tables, option chain, watchlist, screener, and design tokens were prioritized.
