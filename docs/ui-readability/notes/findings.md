# Phase 1 findings (before cleanup)

Captured from Docker build on `:8005` at 100% zoom across five viewports.

## Cross-cutting issues

- Icon rail and agent chrome used 8–10px labels (`DEBATE`, `STRATEGY LAB`, `SCREENER`, role text).
- Meaningful table/header tokens sat at 10px via `--ot-type-size-2xs`.
- Scanlines + vignette + WebGL background always mounted, reducing contrast.
- Muted text contrast was weak on dark panels.
- Numeric formatting was fragmented (`lib/format.ts` vs local `toLocaleString` / INR helpers).
- Density was per-table only; no global comfortable default.
- Decorative effects had no user toggle.

## Route notes

| Area | Issues |
|---|---|
| Home / dashboard | Dense widget labels; competing headings |
| Stock detail / charts | Small toolbar labels; chart axis text not tied to preference |
| Option chain | Tiny cells; inconsistent greek/price precision; weak call/put separation |
| Greeks / flow / heatmaps | Dense badges; color-only cues in places |
| Screener / watchlist | Sub-11px table cells; alignment jitter risk |
| News / alerts | Crowded status chips |
| Portfolio / risk | Hard-coded greens/reds mixed with tokens |
| Settings | No appearance/density controls |
| Nav / rails | 8–9px icon labels; mobile nav under 11px |
| Mobile 390×844 | Horizontal pressure on wide tables; must scroll tables, not shrink type |

See `before/` screenshots and `notes/before-audit.md`.
