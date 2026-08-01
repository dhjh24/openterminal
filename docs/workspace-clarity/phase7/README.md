# Workspace clarity — Phase 7

Issue: https://github.com/dhjh24/openterminal/issues/13

Follow-on after Phases 1–6. Addresses the Phase 2 leftover: secondary Portfolio HQ / AI / intelligence blocks still dominating Home below the priority stack.

## Problem (before)

After the five priority sections, Home still rendered AI Market Outlook, Portfolio HQ, System Health, Intel Wire, and Dashboard Intelligence by default. That diluted the Mission Control hierarchy and made the first useful next step harder to keep in view.

## Change

- Priority stack remains the default Home: Market now, Your desk, Action queue, Portfolio snapshot, Explore all tools
- Secondary panels move behind **More on Home → Show desk details** (collapsed by default)
- Preference persisted in `ot:home:desk-details:v1`
- Mobile desk shortcuts use plain labels (Portfolio / News)

## Screenshots

- `before/` — Phase 6 Home with secondary blocks always visible
- `after/` — decluttered priority Home; optional expanded desk details on desktop
