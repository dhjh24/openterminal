# Workspace clarity — Phase 4

Issue: https://github.com/dhjh24/openterminal/issues/13

## Problem (before)

Desktop chrome always showed Icon Rail, Command Bar, Ticker Tape, Top Bar, Workspace controls, optional Context Rail, and Status Bar. On laptop widths that left little room for charts and tables.

## Change

- Shell chrome modes: **Standard**, **Focus**, **Full**
- Persisted in Appearance settings (`shellChromeMode`)
- Focus hides icon rail, command bar, tape, workspace controls, and context rail
- Standard keeps rail/workspace; omits tape and context rail
- Full restores all chrome
- Chart / tape / DOM / options / workstation routes auto-use Focus on laptop widths when Standard is selected
- Command palette and keyboard shortcuts remain in every mode

## Screenshots

- `before/` / `after/` — desktop captures for Focus vs Full on chart workstation
