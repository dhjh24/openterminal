# Workspace clarity — Phase 8

Follow-on after epic #13 (Phases 1–7). Dedicated landing pages for product hubs so hub navigation no longer deep-links straight into a single leaf tool.

## Problem (before)

Markets / Trade / Research / Portfolio hub clicks opened leaf routes (`/equity/stocks`, chart workstation, screener, holdings). Users never saw a hub overview of related tools.

## Change

- New hub routes (leaf URLs unchanged):
  - `/equity/markets`
  - `/equity/trade`
  - `/equity/research-desk` (avoids conflict with document `/equity/research`)
  - `/equity/portfolio-desk`
- Shared `HubLandingPage` with primary/secondary CTAs and grouped tool cards
- Desktop + mobile hub targets updated; hub active-state still covers nested leaf routes
- Equity index redirects to `/equity/markets`

## Screenshots

- `before/` — Phase 7 Home baseline
- `after/` — Markets / Trade / Research / Portfolio hub landings
