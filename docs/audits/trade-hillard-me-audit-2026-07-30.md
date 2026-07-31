# trade.hillard.me Website, Mobile, PWA, Authentication, and Security Audit

Date: July 30, 2026  
Target: https://trade.hillard.me/  
Tested at: 1363 × 936 desktop browser, zoom/reflow checks, the published 390 × 844 PWA phone asset, deployed responsive CSS, protected-route deep links, and deployed frontend/service-worker code.

## Executive result

The public marketing experience looks polished, and several PWA foundations are present. The release is not ready for trusted public use yet.

Two public account flows need an urgent backend review:

1. `/forgot-access` sends only `email` and `new_password`. No reset token, emailed code, current password, or verified session is visible in the deployed client.
2. `/register` lets an unauthenticated visitor request `viewer`, `trader`, or `admin`, then sends the chosen role to `/api/auth/register`.

If the backend accepts either request as sent, the result is account takeover or admin privilege escalation. These tests were not submitted, since doing so could change an account or create one.

The built-in demo flow fails authentication. Full signed-in page testing could not proceed through the shared browser session, so admin-only functionality remains unverified.

## Severity summary

| Severity | Count | Main areas |
| --- | ---: | --- |
| Critical, pending backend confirmation | 2 | Password reset, public admin registration |
| High | 5 | Broken demo, fake status data, broken glyphs, PWA entry, mobile presentation |
| Medium | 8 | Token storage, workspace presets, touch targets, metadata, cache version, screenshots, 404 handling, CDN dependencies |
| Passed | 8 | HTTPS, route guards, manifest structure, icons, service worker, safe API-cache exclusion, responsive input sizing, public controls |

## Critical findings

### C1. Public password reset appears to lack identity verification

Evidence:

- Public route: https://trade.hillard.me/forgot-access
- The form asks for email, new password, and confirmation.
- The deployed frontend posts `{ email, new_password }` to `/api/auth/forgot-access`.
- No reset token, one-time code, current password, signed session, or emailed-link state is passed by the client.

Risk:

- If the backend accepts this payload without independent proof, anyone who knows an account email can replace its password.

Required fix:

- Disable the endpoint publicly until it uses a random, single-use reset token.
- Store only a hashed token server-side.
- Set a short expiration, such as 10–15 minutes.
- Invalidate all active refresh sessions after a successful reset.
- Return the same generic response for known and unknown email addresses.
- Add per-IP and per-account rate limits.
- Add audit events and alerts for reset requests and completions.

Acceptance test:

- A request without a valid reset token cannot change any password.
- Reused, expired, forged, or account-mismatched tokens fail.

### C2. Public registration exposes the `admin` role

Evidence:

- Public route: https://trade.hillard.me/register
- The role selector contains `VIEWER`, `TRADER`, and `ADMIN`.
- The selected role is sent to `/api/auth/register`.

Risk:

- If the backend trusts the supplied role, a new visitor can create an administrator account.

Required fix:

- Remove role selection from public registration.
- Force all public registrations to `viewer` on the server.
- Make role promotion an authenticated administrator action with audit logging.
- Reject `admin`, `trader`, or any unknown role submitted by a public client.
- Consider invitation-only registration for this private trading terminal.

Acceptance test:

- Submitting `role: "admin"` from an unauthenticated request never creates or upgrades an administrator.

## High-priority findings

### H1. Demo Access is broken and its label is misleading

Observed flow:

1. `DEMO ACCESS` only fills static credentials.
2. It does not submit or enter the demo workspace.
3. Submitting the filled credentials returns `AUTHENTICATION FAILED`.

Impact:

- New users cannot tour the product.
- QA cannot use the intended safe test mode.
- The button reads as an action but behaves like autofill.

Fix:

- Production option A: remove the demo button.
- Production option B: seed a restricted, read-only demo account during deployment and make one click authenticate it.
- Block orders, settings changes, API-key entry, account management, and persistent user data in demo mode.

### H2. Login status, prices, uptime, latency, and session count are hard-coded

The login screen presents:

- `SYSTEM STATUS: ONLINE`
- Fixed ticker prices
- `UPTIME 99.97%`
- `LATENCY 2ms`
- `SESSIONS 1,247`

The deployed bundle contains these values as constants. They are not a live health check.

Impact:

- Users can see “online” during a backend outage.
- Fixed market numbers look live and may be mistaken for current prices.
- Trust drops once the values are recognized as samples.

Fix:

- Connect status to a real read-only health endpoint.
- Use current quote data for the ticker.
- Show `Sample data` or remove the panels when no live provider is configured.
- Display `Unknown` when telemetry cannot be read.

### H3. Trading signs and action icons render as literal question marks

Visible examples:

- Ticker changes show `?24.30` instead of a positive or negative sign.
- The password visibility control shows `?`.
- The access button ends with `?`.

The ticker bundle contains a literal question mark for every direction.

Fix:

- Use SVG icons or plain `+` and `−` text with hidden accessible labels.
- Do not depend on a specialty font for required action meaning.
- Add a screenshot assertion that rejects question-mark placeholders in core controls.

### H4. The public entry page is not PWA-enabled

The application page at `/login` has a manifest, theme color, Apple PWA metadata, and `lang="en"`. The public root page lacks:

- `<link rel="manifest">`
- Theme color
- Apple PWA metadata
- Document title
- Description
- HTML language

Impact:

- A visitor landing at `https://trade.hillard.me/` may not receive install behavior.
- Saved iOS home-screen behavior can differ from the application route.
- Search and accessibility metadata are incomplete.

Fix:

- Put the same PWA and metadata tags on `/`, `Features.dc.html`, `Docs.dc.html`, and `Roadmap.dc.html`.
- Use unique titles and descriptions for each page.

### H5. The published phone PWA screenshot exposes a broken mobile header

Manifest asset:

- `/screenshots/narrow-home.png`
- Declared size: 390 × 844
- Label: `Mission Control on phone`

Observed:

- The screenshot is the marketing landing page, not Mission Control.
- Desktop navigation remains in one row.
- The `Motion · Full` control is clipped at the right edge.

The wide screenshot has the same labeling mismatch: it shows the landing page, not Mission Control.

Fix:

- Create real signed-in PWA screenshots at 390 × 844 and 1280 × 720.
- Use a mobile menu on the marketing pages.
- Do not publish a clipped image as the install preview.

## Medium-priority findings

### M1. Access and refresh tokens are stored in `localStorage`

The deployed frontend uses:

- `ot-access-token`
- `ot-refresh-token`

Any successful script injection can read both tokens.

Fix:

- Put the refresh token in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie.
- Keep short-lived access state in memory.
- Add a strict Content Security Policy and remove unsafe script sources.
- Rotate refresh tokens and revoke the token family after reuse.

### M2. Trader, Quant, PM, Risk, and Ops look like navigation but do not navigate

The controls save a preset locally and dispatch `ot:preset-change`. The home page imports the terminal shell but does not consume the workspace preset.

Observed result:

- The active button can change.
- The URL and main page content stay the same.

Fix option A:

| Control | Destination |
| --- | --- |
| Trader | Trading cockpit or watchlist |
| Quant | Backtesting or model lab |
| PM | Portfolio headquarters |
| Risk | Risk dashboard |
| Ops | Operations dashboard |

Fix option B:

- Rename the group to `Workspace preset`.
- Change visible widgets, shortcuts, and context rail at once.
- Announce the new preset through an accessible live region.

### M3. Text and tap targets are too small

Observed on the public page:

- Much of the navigation and supporting text is 10–11 px.
- Several links are only 13–15 px high.
- Landing-page tab buttons are about 32 px high.

Observed on login:

- Show-password control: about 7 × 19 px.
- Remember checkbox: 13 × 13 px.
- Several links and labels: 11 px.
- Primary login button: 42 px high.

Fix:

- Use at least 14 px for supporting UI text.
- Use 16 px for form inputs.
- Give important controls a 44 × 44 px minimum hit area.
- Keep compact visual icons inside a larger clickable wrapper.

### M4. Mobile login puts decoration before the form

At widths below 1280 px, deployed CSS changes login to one column with:

- First row: `50vh` hero
- Second row: authentication form

On a phone, the user must pass a half-screen decorative area before reaching sign-in.

Fix:

- Put the form first on widths below 820 px.
- Hide or reduce the hero to a compact brand header.
- Keep the main fields and submit button visible in the first screen.

Positive detail:

- Mobile input font size is forced to 16 px, which avoids automatic iOS zoom.

### M5. Service-worker build version is `unknown`

The deployed application registers:

`/sw.js?v=unknown`

The worker creates:

`otui-shell-unknown`

Impact:

- Cache names do not identify the deployed release.
- Update diagnosis is harder.
- Old navigation entries can remain in the same shell cache name.

Fix:

- Inject the release commit SHA or immutable build ID at build time.
- Display the same build ID in the app diagnostics page.
- Add an upgrade test across two consecutive releases.

Positive detail:

- `/api/`, `/health`, and `/auth` are excluded from worker caching.
- Navigation and scripts use network-first behavior.
- Live market API responses are not cached by the worker.

### M6. Marketing screenshots and product identity are stale

The public workspace screenshot shows:

- Indian market symbols and INR portfolio values
- NASDAQ and USD controls in the same view
- An upstream operator identity
- Upstream project branding

The public site description says it is a U.S. trading terminal.

Fix:

- Capture new screenshots from the deployed U.S. configuration.
- Remove personal operator identifiers.
- Point GitHub and support links to the repository and owner responsible for this deployment, or label upstream links clearly.

### M7. Unknown routes silently show the landing page

An invalid path loads the full marketing home page with a blank title. There is no not-found message.

Impact:

- Broken links look successful.
- Monitoring and search engines cannot distinguish missing content.

Fix:

- Return a real 404 status with a concise page and links to Home and Login.

### M8. The marketing page depends on third-party runtime assets

The public root loads React and ReactDOM from `unpkg.com` and fonts from Google.

Impact:

- Content behavior can fail under strict networks, content blockers, or CDN incidents.
- The runtime and privacy surface is larger than needed for a mostly static page.

Fix:

- Bundle or self-host the small required runtime.
- Self-host fonts or use system fonts.
- Pin integrity metadata if an external script remains.

## PWA results

| Check | Result |
| --- | --- |
| HTTPS | Pass |
| Manifest on application routes | Pass |
| Manifest on public root | Fail |
| `start_url` | `/home` |
| Standalone display | Pass |
| Scope `/` | Pass |
| 192 and 512 icons | Pass; real dimensions match |
| Maskable icons | Pass |
| Monochrome icon | Pass |
| Apple touch icon | Pass on application page |
| Narrow and wide screenshot files | Pass |
| Screenshot content and labels | Fail |
| Service worker registration | Pass |
| Live API exclusion from cache | Pass |
| Release-specific worker version | Fail; `unknown` |
| Protected PWA shortcuts | Redirect to `/login` |
| Resume original shortcut after login | Not verified |
| Offline shell | Code present; full network-off run not completed |

## Public route and interaction results

| Area | Result |
| --- | --- |
| Home landing | Loads |
| Features | Loads |
| Docs | Loads |
| Roadmap | Loads |
| Login | Loads |
| Forgot access | Loads; security review required |
| Registration | Loads; public admin role exposed |
| Replay / Live toggle | Works |
| Strategy / Portfolio / Desk toggle | Works |
| Motion control | Works |
| Home, Watchlist, Stocks, Options, News, Alerts deep links when signed out | Redirect to Login |
| Demo access | Fails authentication |
| Site-origin console exceptions during public tests | None observed |

## Authenticated-area limitation

The shared audit browser remained signed out after the manual-login handoff. The demo account failed. The following areas were mapped from deployed routes but not fully exercised:

- Mission Control
- Stocks and chart workstation
- Watchlists and alerts
- Options chain and flow
- Paper trading and order management
- Portfolio and journal
- Backtesting and model lab
- Risk, correlation, operations, plugins, settings, and account administration
- Mobile signed-in navigation
- Live WebSocket/data-provider behavior

No live order, password reset, account registration, role change, or settings mutation was attempted.

## Recommended fix order

1. Disable or secure public password reset.
2. Remove public admin/trader role selection and reject supplied elevated roles server-side.
3. Rotate the exposed administrator password and revoke active refresh tokens.
4. Fix or remove demo access.
5. Replace hard-coded operational and market data.
6. Repair question-mark glyphs.
7. Add PWA metadata to the public root and replace mobile screenshots.
8. Rework mobile login and touch-target sizes.
9. Make workspace presets visibly change the workspace or convert them to navigation.
10. Version the service worker with the real release ID.
11. Replace stale screenshots, operator identity, and upstream-only calls to action.
12. Add authenticated desktop, phone, tablet, offline, and upgrade tests to CI.

## Copy/paste implementation prompt

```text
Audit and repair the repository that deploys https://trade.hillard.me.

Work in phases, keep each change reviewable, and do not place live trades or modify production user accounts.

Phase 0 — emergency security
1. Trace POST /api/auth/forgot-access. Disable it until password reset requires a cryptographically random, hashed, single-use, account-bound token with a 10–15 minute expiry. Return a generic response for known and unknown emails. Add rate limits, session revocation, audit events, and backend tests for missing, forged, expired, reused, and mismatched tokens.
2. Remove role selection from public registration. The backend must force public accounts to viewer and reject admin/trader/unknown roles from unauthenticated callers. Role promotion must require an authenticated admin and create an audit event.
3. Rotate exposed credentials outside the repository. Add secret scanning. Do not commit any new secret.
4. Move refresh tokens from localStorage to Secure, HttpOnly, SameSite=Strict cookies. Keep short-lived access state in memory. Add refresh rotation and token-family reuse detection.

Phase 1 — authentication and truthful status
1. Fix Demo Access. Either remove it in production or seed a restricted read-only demo account. If kept, one click must authenticate; no orders, API keys, account edits, or persistent personal data.
2. Replace hard-coded SYSTEM STATUS, uptime, latency, sessions, and market quotes with real read-only endpoints. Show Unknown or Sample data when unavailable.
3. Replace every literal question-mark placeholder with SVG icons or accessible +/− text.
4. Add authentication integration tests covering valid login, invalid login, refresh rotation, logout, account lock/rate limit, and protected route redirects.

Phase 2 — mobile and PWA
1. Add title, description, lang, manifest, theme color, Apple PWA tags, icons, and canonical URL to /, Features.dc.html, Docs.dc.html, and Roadmap.dc.html.
2. Replace manifest screenshots with real Mission Control captures at 390x844 and 1280x720. Remove all personal operator identifiers and stale Indian-market data.
3. Add a mobile marketing header with a menu; no clipped controls at 320, 375, 390, 412, or 430 CSS pixels.
4. Put the login form before decorative content below 820 px. Keep it usable above the keyboard.
5. Set core tap targets to at least 44x44 px and supporting UI text to at least 14 px. Keep inputs at 16 px on phone.
6. Inject the Git commit SHA into the app and service worker instead of unknown.
7. Verify first install, offline shell, online recovery, second deployment update, shortcut launch, and authenticated route return.

Phase 3 — workspace behavior and content
1. Fix Trader, Quant, PM, Risk, and Ops. Either navigate each control to its desk or make the current page visibly replace widgets, shortcuts, and context. Add aria-pressed and a live-region announcement.
2. Add a real 404 route and status.
3. Replace stale marketing screenshots and point deployment-owner links to the correct repository/support channel.
4. Bundle or self-host the landing-page runtime and fonts.

Phase 4 — automated verification
1. Add Playwright projects for 1440x900 desktop, 768x1024 tablet, iPhone 390x844, and Android 412x915.
2. Cover login, protected deep links, PWA shortcuts, mobile menus, workspace controls, watchlist, stock search, options, news, alerts, paper trading safety gates, settings permissions, and logout.
3. Add axe accessibility checks and assertions for 44px targets, no horizontal overflow, visible focus, valid labels, one h1, no literal ? placeholder icons, and no text below the approved minimum size.
4. Add backend security tests for reset tokens, role escalation, JWT expiry, refresh reuse, rate limits, authorization on every protected endpoint, and demo isolation.
5. Run production build, unit tests, API tests, Playwright, Lighthouse PWA/accessibility checks, and dependency/secret scans.

Provide:
- root causes
- files changed
- migrations or environment changes
- test evidence
- screenshots at every viewport
- remaining risks
- rollback steps

Stop and report any backend behavior that permits unverified password reset or public admin creation before working on cosmetic changes.
```

