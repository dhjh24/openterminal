# Workspace clarity — Phase 3

Issue: https://github.com/dhjh24/openterminal/issues/13

## Problem (before)

Phone chrome exposed two More entry points (header + bottom nav) and used Watch / Stocks / Options tabs that did not match product hubs. The More sheet was a flat list, and search mixed result types without clear groups.

## Change

- Header: logo/home, symbol + price, search, notifications — **no More**
- Bottom nav: **Home, Markets, Trade, Portfolio, More**
- Nested-route hub highlighting
- More sheet rebuilt as grouped sections (Research, Alerts, Tools, Agent, Settings, Account) via `MobileBottomSheet` (Escape, focus trap, focus return)
- Universal search groups: Recent searches, Symbols, Pages and tools, Commands

## Screenshots

- `before/` — Phase 2 mobile baseline at 390×844
- `after/` — matching captures after Phase 3
