# Mobile Design Rules

## Layout
- All pages use 16px horizontal padding on mobile
- No page-level horizontal overflow (use global containment from `mobile-responsive.css`)
- Fixed bottom nav gets `pb-[max(0.25rem,env(safe-area-inset-bottom))]`
- Scrollable content gets `pb-20` (80px) clearance on pages with bottom nav
- Desktop route nav hidden on mobile (`hidden md:block`)
- Permanent search replaced with compact search button

## Touch Targets
- All interactive elements: minimum 44×44px
- Use `min-h-[44px]` and `min-w-[44px]` on buttons, links, inputs
- Bottom nav items: 44px min-height with flex column layout

## Typography
- Body text: 14–16px
- Form inputs: 16px minimum (prevents iOS zoom)
- Labels: 11–12px with `tracking-wider`
- Financial values: `tabular-nums` for monospace alignment
- No letter-spacing above 0.08em on mobile
- Descriptions and emails: `overflow-wrap: break-word`
- No text under 11px for meaningful content

## Filter Pattern
- Collapsed by default (compact toolbar with chips)
- Opens as bottom sheet with 85vh max height
- Focus trap inside open sheet
- Escape key closes sheet
- Focus restored to trigger button on close
- Apply button closes sheet
- Reset reverts to defaults
- Popular/horizontal chips scroll inside their own container
- Selectable input fields use 16px font

## Bottom Navigation
- 5 items: Home, Watch, Stocks, Options, More
- More menu contains secondary routes + Agent
- Active state: accent border + accent text
- Safe-area bottom padding

## Safe Areas
- `env(safe-area-inset-top)` on status bar
- `env(safe-area-inset-bottom)` on fixed bottom nav
- `env(safe-area-inset-left/right)` on full-screen overlays

## Loading & Empty States
- Loading: skeleton or spinner + "Loading..." text
- Empty: concise message with action guidance
- Error: inline message, no raw JSON
- Auth errors: redirect to login, show session-expired message

## Charts
- Do not render until container width and height are positive
- Use ResizeObserver for responsive sizing
- Guard `removeSeries` with null/undefined checks
- `min-width: 0` on grid/flex parents containing charts
- Remove series before chart destroy
- Pause updates when tab hidden
