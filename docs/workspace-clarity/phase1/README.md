# Workspace clarity — Phase 1

Issue: https://github.com/dhjh24/openterminal/issues/13

## Problem (before)

Mission Control exposed five always-visible preset buttons (`Trader`, `Quant`, `PM`, `Risk`, `Ops`). Selecting one stored a preset and dispatched an event, but gave weak confirmation: no apply/open affordance, no pinned-tool preview, and easy to miss headline/section changes. Mobile used a flat list that felt like page tabs.

## Change

- One compact `… workspace ▾` switcher on desktop; enriched mobile sheet.
- Each workspace shows purpose, six pinned tools, landing screen, **Apply**, and **Apply and open …**.
- Toast + `aria-live` confirmation after apply.
- First-use question: “What do you mainly use OpenTerminal for?”
- Home title area shows active workspace badge + pinned tools row; primary action updates with the preset.

## Screenshots

- `before/` — baseline at 390×844, 768×1024, 1366×768, 1440×900
- `after/` — matching captures after Phase 1
