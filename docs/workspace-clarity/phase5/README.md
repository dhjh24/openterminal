# Workspace clarity — Phase 5

Issue: https://github.com/dhjh24/openterminal/issues/13

## Problem (before)

Primary navigation and workspace labels still leaned on internal abbreviations (`PM`, `Ops`, glyph badges, short rail codes). Advanced tools often lacked accessible descriptions, so screen-reader and new-user paths were harder than the visible UI suggested.

## Change

- Plain-language primary labels: Portfolio / Operations workspaces, Markets / Charts rail items with descriptions, expanded sidebar names (Depth of market, Order management, Relative strength, etc.)
- Every launcher card carries a description; badges use `<abbr>` with full accessible titles
- Icon rail uses Lucide icons + `aria-label` of the form `Label. Description`
- Shared helpers in `frontend/src/home/productLanguage.ts`
- Hard-fail Playwright axe audits (no serious/critical) for Home, workspace switcher, mobile More/search, and Explore all tools (`product-language-a11y-phase5.spec.ts`)

## Screenshots

- `before/` — Phase 2 Mission Control baseline (abbreviation-heavy labels still present) at 390×844, 768×1024, 1366×768, 1440×900
- `after/` — matching captures after Phase 5 plain-language + a11y pass
