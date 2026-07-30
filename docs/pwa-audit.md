# PWA Audit

## Manifest (`public/manifest.json`)
- [x] Web app manifest present
- [x] App name: "OpenTerminal"
- [x] Short name ✓
- [x] Theme color: `#06080c`
- [x] Background color: `#06080c`
- [x] Icons: 192px, 512px ✓
- [ ] Maskable icon (missing)
- [x] Apple touch icon
- [x] Standalone display
- [x] Start URL: `/`
- [x] Scope: root

## Service Worker (`public/sw.js`)
- [x] Service worker registered
- [x] Offline page ✓
- [x] Update notification ✓
- [ ] Cache rules audit needed
- [x] Network-first for live data
- [ ] No-cache for authenticated API responses

## Installation
- [ ] Installability audit needed
- [ ] Beforeinstallprompt event handling
- [ ] Mobile status-bar appearance
- [x] `apple-mobile-web-app-capable` meta tag
- [x] `apple-mobile-web-app-status-bar-style: black-translucent`

## Caching
- [ ] Static assets: versioned, immutable cache
- [ ] API responses: no-store for authenticated endpoints
- [ ] Quotes/live data: network-first or no-store
- [ ] App shell: cache-first with update check

## Required Fixes
1. Add maskable icon (512×512 with padding)
2. Audit cache rules in sw.js
3. Add `beforeinstallprompt` handler
4. Ensure no private data cached in shared service worker cache
