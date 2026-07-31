# Trade.hillard.me Live Demo Audit

Date: July 30, 2026  
Target: [trade.hillard.me](https://trade.hillard.me/)  
Profile: U.S.-only (`MARKET_PROFILE=US`, `VITE_MARKET_PROFILE=US`)  
Status: P0 remediation required

## Scope

The built-in demo account was used to review the public landing page, authentication, Mission Control, ticker search, Security Hub, chart, options chain, contract selection, watchlist, news, portfolio, alerts, desktop layout, supplied iPhone PWA captures, and PWA delivery.

No holding, alert, watchlist item, strategy, or order was saved or deleted. Broker execution and external delivery channels were not activated.

## Overall result

The demo has broad functional coverage, but several failures can mislead a user making a market decision:

- Unrelated fallback stories are scored as ticker-specific NVIDIA news.
- U.S. portfolio pages use the Indian rupee symbol.
- AAPL portfolio and alert fixtures use a default price of `2500`.
- Mobile screens retain the desktop header, route links, workspace controls, and wide modules.
- The PWA manifest returned Cloudflare `502` twice during the audit.
- The demo session returned to login without an explanation.
- Portfolio navigation entered `_otui_chunk_recovery` and displayed a new-build reload prompt.
- Recharts logged repeated negative width and height warnings.
- Missing data can appear as zero instead of unavailable.

The largest problem is shared infrastructure and shell behavior, not one isolated page.

## Flow health

| Step | Health | Result |
|---|---|---|
| Public landing | Needs work | Strong branding; duplicated accessible heading and very small navigation text. |
| Demo access | Mixed | One-action demo login works; session continuity failed during the run. |
| Mission Control | Poor | Search, ticker, two navigation systems, breadcrumb, workspace controls, content, status rail, and agent launcher compete for space. |
| Ticker search | Good | `NVDA` returned useful command choices and preserved symbol context. |
| Security Hub | Mixed | Clear tabs; many unexplained missing fields and presets that appear to do little. |
| Chart | Mixed desktop / broken mobile | Desktop chart is useful; toolbar is crowded and phone controls overlap. |
| Options chain | Mixed desktop / broken mobile | Data is present; the phone filter area dominates the opening screen. |
| Watchlist | Needs work | Invalid-looking volume, universal `0.00%` changes, and unnamed icon buttons. |
| News | Broken | Unrelated market fallback stories are presented and scored as NVIDIA news. |
| Portfolio | Broken | INR formatting and unrealistic U.S. equity defaults create artificial losses. |
| Alerts | Mixed | Modal structure is clear; AAPL alert defaults to `2500`. |
| PWA | Broken during test | Manifest request returned a host-layer `502` after one reload. |
| Release flow | Unstable | Session loss, chunk recovery, update prompt, and changing connection status. |

## P0 — Data trust and regional cleanup

### 1. Repair ticker-news scoping

Observed on the NVDA News page:

- The page claimed to show NVIDIA headlines.
- One story covered Kaleon S.p.A.
- One story covered a Bitcoin-funded Michigan data center.
- Both stories were used to calculate NVIDIA sentiment.

Required changes:

- Require an explicit symbol match, company-name match, provider ticker metadata, or approved alias match before a story enters the ticker feed.
- Keep market fallback stories in a separate market-wide feed.
- Exclude fallback stories from per-symbol sentiment and emotion scores.
- Return `matched_symbols`, `match_reason`, `source`, `published_at`, `ingested_at`, `delay_status`, and `data_quality`.
- Add a minimum relevance score and log rejected candidates.
- Show a clear empty state when no relevant ticker stories exist.

Acceptance checks:

- NVDA ticker news cannot contain unrelated stories with no NVIDIA match.
- Market fallback content is labeled `Market news`.
- Fallback content does not alter ticker sentiment.
- Unit tests cover ticker symbol, official name, aliases, false positives, and no-result states.

### 2. Remove Indian defaults from U.S. mode

Observed:

- Portfolio value and P&L used `₹`.
- AAPL average buy defaulted to `2500`.
- The alert builder defaulted to `NASDAQ:AAPL Price above 2500`.
- A prior mobile options capture showed `N225` inside the U.S. universe.

Required changes:

- Use `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` through one shared formatter.
- Remove INR symbols and India-specific defaults from frontend constants, backend fixtures, seed data, tests, screenshots, migrations, local storage defaults, and demo bootstrap data.
- Limit the U.S. symbol universe to supported U.S. equities, ETFs, indices, futures, and options underliers.
- Use realistic demo values near the current quote or leave optional fields blank.
- Reset incompatible stored market-profile data when the profile changes.

Acceptance checks:

- No `₹`, `INR`, `NIFTY`, `N225`, `BANKNIFTY`, or India exchange value appears in U.S. mode.
- Demo AAPL fixtures use realistic USD values.
- New price alerts start blank or derive a reasonable value from the live quote.
- A repository scan and test fixture scan enforce the U.S.-only profile.

### 3. Stabilize PWA and release delivery

Observed:

- `/manifest.json` returned Cloudflare `502` twice.
- Portfolio entered `_otui_chunk_recovery`.
- A new-build prompt appeared during normal route movement.
- The authenticated session returned to login during the same run.

Required changes:

- Serve the manifest, icons, service worker, offline shell, and release metadata from stable static routes.
- Generate and inject one non-empty build identifier in HTML, the service worker, lazy-chunk recovery, and release metadata.
- Keep the previous release assets during deployment long enough for open clients to update.
- Cache an offline HTML shell plus the minimal application assets.
- Prune old caches after activation.
- Limit chunk recovery to one controlled reload per build.
- Preserve the requested route through recovery.
- Show a recovery screen with Retry and Reload actions when recovery fails.
- Do not invalidate an authenticated session during a frontend asset rollout.

Acceptance checks:

- `/manifest.json` returns `200` with a valid manifest content type.
- Every referenced icon and screenshot returns `200`.
- Service-worker registration succeeds.
- An installed PWA can launch its offline shell with the network disabled.
- A simulated old-client deployment loads the new route without a blank screen or reload loop.
- Authentication survives a frontend release.

### 4. Treat missing and stale data correctly

Required changes:

- Render unavailable values as `—`, never `$0.00`, `0.00%`, or a fabricated number.
- Add `live`, `delayed`, `cached`, `fallback`, `calculated`, `stale`, and `unavailable` labels.
- Show source and timestamp near decision-grade market data.
- Disable dependent calculations when required inputs are missing.
- Flag extreme or invalid IV, volume, quote, and portfolio values.

Acceptance checks:

- Missing options data cannot look like a real zero.
- Stale watchlist values have a visible timestamp and status.
- Invalid inputs do not feed sentiment, P&L, risk, or strategy calculations.

## P1 — Shared mobile shell

The phone experience currently behaves like a wide desktop interface clipped to a narrow screen.

Required structure below the mobile breakpoint:

1. Compact app bar with page title, ticker, search icon, notifications, and account access.
2. Expandable search overlay instead of the permanent full-width command bar.
3. Collapsed market ticker showing one or two selected assets.
4. No desktop route-link row.
5. Workspace presets inside a menu or sheet.
6. One scroll container for page content.
7. Fixed bottom navigation with matching content padding and safe-area support.
8. Agent launcher positioned above the bottom navigation.

Global acceptance checks at `390x844`, `430x932`, `768x1024`, `1024x768`, and `1440x900`:

- No horizontal page scrolling.
- No clipped heading, card, form, table, chart, menu, dialog, or toast.
- Fixed controls do not cover page content.
- All primary touch targets are at least `44x44` CSS pixels.
- Text supports browser zoom and dynamic type without overlap.
- Portrait and rotation preserve the active task.

### Mobile chart

Required changes:

- Size the chart from available content space rather than `100vh` minus a fixed constant.
- Put primary timeframe choices in a compact horizontal control.
- Move secondary chart functions into a More menu or bottom sheet.
- Keep legend, price, current interval, and live/delayed status readable.
- Provide a reset-zoom action.
- Fix chart containers that report negative width or height.

### Mobile options

Required changes:

- Put symbol, expiry, and range filters in a bottom sheet.
- Display spot, IV, PCR, and max pain in a compact two-column summary.
- Open near the ATM strike by default.
- Add Calls and Puts segmented views for phone screens.
- Keep contract details and Add to Strategy in a bottom sheet.
- Explain whether the action creates a draft, paper strategy, or executable order.

### Mobile tables

- Use a responsive card or priority-column pattern.
- Keep symbol, price, change, status, and primary action visible.
- Move secondary columns into expandable details.
- Provide an accessible table view for larger screens.

## P1 — User flow and information structure

### Workspace presets

`Trader`, `Quant`, `PM`, `Risk`, and `Ops` appear to be navigation, but selecting a preset can leave the visible page unchanged.

Required changes:

- Define the exact modules, density, theme, data columns, and shortcuts controlled by each preset.
- Announce the selected preset and list the visible change.
- Persist the preset per user.
- Remove presets that have no real effect.

### Navigation

- Keep one primary desktop navigation system.
- Use context navigation inside a page only when it changes that page.
- Remove duplicated route links.
- Keep breadcrumbs compact and meaningful.
- Make the phone bottom navigation the only persistent phone route control.

### Portfolio

Split the current long page into:

- Overview
- Holdings
- Risk
- Income
- Tax Lots
- Events
- Backtests

Keep Add Holding available from Holdings or a focused modal. Do not place every portfolio tool in one initial viewport flow.

## P2 — Accessibility

Observed risks:

- Duplicate landing-page heading in the accessibility tree.
- Unnamed Watchlist buttons.
- Small text and controls in global rails and chart toolbars.
- Heavy reliance on green, red, and orange for status.
- Fixed phone controls covering content.
- Dense options tables without a phone reading pattern.
- Workspace changes with weak state communication.

Required checks:

- Keyboard-only route and task completion.
- Visible focus for every control.
- Accessible names for every icon button.
- Status announcements for authentication, data refresh, connection, save, error, and release changes.
- Contrast checks for all themes.
- Browser zoom at `200%`.
- Reduced-motion behavior.
- Screen-reader checks on login, ticker search, chart, options, portfolio, and alerts.

## Desktop improvements

- Reduce repeated global chrome and keep more vertical space for the current task.
- Group chart controls by purpose and replace unexplained abbreviations with labeled menus or tooltips.
- Abbreviate large financial values with a precise tooltip.
- Provide a reason and retry action for unavailable fields.
- Keep release notices away from primary actions and fixed navigation.
- Make connection state consistent across header, page content, and footer.

## Test matrix

### Frontend

- Unit tests for U.S. currency formatting and profile filtering.
- Component tests for missing, stale, fallback, and live data states.
- Component tests for preset state and visible module changes.
- Component tests for chart container sizing.
- Accessibility tests for icon names, dialogs, focus, and live status.

### Backend

- News relevance tests with positive, alias, negative, and ambiguous cases.
- Data-quality tests that reject invalid market inputs.
- Demo bootstrap tests for U.S. fixtures and USD values.
- Session tests across frontend release changes.

### Browser tests

- Demo login to Mission Control.
- Search `NVDA` and open Security Hub.
- Open Chart and verify a nonzero container.
- Open Options and select the ATM contract.
- Open News and verify every displayed article matches NVDA.
- Open Portfolio and verify USD formatting.
- Open Create Alert and verify a blank or quote-derived value.
- Repeat core routes at phone, tablet, laptop, and desktop sizes.
- Test install, standalone launch, offline shell, release rollover, and session continuity.

## Implementation prompt

```text
Work through docs/audits/TRADE_HILLARD_LIVE_DEMO_AUDIT_2026-07-30.md in priority order.

Start with P0 data trust and release safety. Repair ticker-news relevance, remove every Indian regional default from U.S. mode, stabilize manifest/service-worker/chunk delivery, preserve authenticated sessions during releases, and render missing data as unavailable rather than zero.

Next, refactor the shared responsive shell once so every protected route benefits. Build the compact mobile header, hide desktop route links on phones, collapse the ticker, move workspace presets into a menu, reserve safe-area space for bottom navigation, and position the agent launcher above it. Fix chart sizing and move phone chart/options controls into compact menus or bottom sheets.

Then simplify Portfolio navigation, define real behavior for Trader/Quant/PM/Risk/Ops presets, remove duplicate navigation, and close the named accessibility gaps.

Add regression tests before marking a finding complete. Test 390x844, 430x932, 768x1024, 1024x768, and 1440x900. Run the existing backend, frontend, and browser gates. Do not hide failures with mock zero values, CSS overflow clipping, disabled tests, or broad exception handling.

For every completed item, report:
- files changed
- root cause
- user-facing result
- tests added
- commands run and results
- remaining risks

Stop if a change would alter real trading or broker behavior. The current U.S. profile is simulation and analysis focused.
```

## Completion criteria

The audit is complete only when:

- ticker sentiment uses relevant ticker news;
- U.S. mode contains no Indian currency, symbol, exchange, or default-price leakage;
- demo data is realistic and clearly labeled;
- mobile core flows fit without page-level horizontal scrolling;
- charts and filters remain usable on phone screens;
- the PWA installs, launches offline, and updates without stale-chunk loops;
- sessions remain valid through frontend releases;
- missing data never appears as a real zero;
- the named browser and accessibility tests pass.
