# Workspace clarity — Phase 6

Issue: https://github.com/dhjh24/openterminal/issues/13

Follow-on after Phases 1–5. Completes the epic’s **Primary navigation** direction on desktop and consolidates admin tools.

## Problem (before)

Desktop Icon Rail still listed a long set of peer destinations (Charts, Launchpad, Screener, Alpha Zoo, Export, Shadow, …). That competed with the five product hubs and left Data Quality / OMS / Plugins as scattered More/Tools links instead of a Settings & Admin area.

## Change

- Desktop Icon Rail: **Home, Markets, Trade, Research, Portfolio**, plus **More**
- Shared hub matching in `mobileNav.ts` (`DESKTOP_HUBS`, `isDesktopHubActive`)
- More (desktop panel + mobile sheet): **Settings & Admin** group for Appearance, Data quality, Order management, Plugins, Operations, Account
- Settings page: **Settings & Admin** destination panel + `#appearance` anchor
- Routes unchanged

## Screenshots

- `before/` — Phase 5 dense rail baseline
- `after/` — five-hub rail, More panel, Settings & Admin
