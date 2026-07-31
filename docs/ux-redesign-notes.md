# Mobile-first UX redesign notes

## Summary
Shared `TerminalShell` now uses a compact phone chrome below 768px: 50px header (logo, live ticker/price, search, bell, More), five-tab bottom navigation with labeled More sheet, search bottom sheet (~65dvh, above the nav), and workspace presets as a single selector + sheet (not page tabs). Desktop (≥1024 / `md+`) keeps CommandBar, TickerTape, TopBar route strip, workspace control bar, and status bar.

USD/`en-US` formatting replaces INR/`en-IN`/`₹` in portfolio and related surfaces. Login password toggle uses Eye/EyeOff. Chart tools default closed on first paint; chart panels get a 320px mobile minimum height.

## Screenshots
Captured from local production preview (`vite preview`):

- `docs/ux-redesign-screenshots/after-phone-390x844-login.png`
- `docs/ux-redesign-screenshots/after-desktop-1440x900-login.png`

Prior PWA assets for comparison: `frontend/public/screenshots/narrow-home.png` (390×844) and `wide-home.png`.

Signed-in Mission Control phone screenshot for the PWA manifest should be re-captured after deploying this build to trade.hillard.me (auth required).

## Test commands
```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd frontend && npm test -- --run \
  src/__tests__/MobileBottomNav.test.tsx \
  src/__tests__/MobileSearchSheet.test.tsx \
  src/__tests__/WorkspacePresetSheet.test.tsx \
  src/__tests__/formatters.us.test.ts \
  src/__tests__/useIsPhone.test.ts \
  src/__tests__/chartDimensions.test.ts
npx playwright test frontend/tests/e2e/mobile-shell-redesign.spec.ts
```
