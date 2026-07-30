# Site-wide Mobile Route Audit

**Branch:** `fix/sitewide-mobile-pwa`  
**Generated:** 2026-07-30  
**Scope:** Every frontend route served by the React Router in `frontend/src/App.tsx`

## Status Legend

| Status | Meaning |
|---|---|
| ✅ Fixed | Repaired during this branch |
| 🔍 Defect | Known issue, fix planned in child PR |
| ⬜ Not reviewed | Not yet inspected |
| 🚫 Blocked | External dependency required |
| ✅ Verified | Tested at all target viewports |

---

## Login & Authentication (Public Routes)

| Route | Page | Shared Layout | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | LoginPage | None | ✅ Fixed | N/A | ✅ OK | ✅ OK | ✅ Fixed | Public | ✅ Fixed |
| `/register` | RegisterPage | None | ⬜ | N/A | ⬜ | ⬜ | ⬜ | Public | ⬜ Not reviewed |
| `/forgot-access` | ForgotAccessPage | None | ⬜ | N/A | ⬜ | ⬜ | ⬜ | Public | ⬜ Not reviewed |

### Login page fixes applied
- Horizontal overflow guard added via `mobile-responsive.css`
- Safe-area padding for iPhone status bar
- No fixed navigation on public routes

---

## Home & Mission Control

| Route | Page | Shared Layout | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|---|
| `/home` | HomePage | TerminalShell | ✅ Fixed | ✅ Fixed | ✅ OK | ✅ OK | ✅ OK | Required | ✅ Verified |
| `/` | RootRedirect | None | N/A | N/A | N/A | N/A | N/A | N/A | ✅ OK |

### Home page fixes applied (PR #9)
- Compact mobile header with expandable desk panel
- Scrollable ticker and clock rails
- 5-item bottom navigation
- pb-20 clearance
- Agent in More menu
- Before/after screenshots at 7 viewports

---

## Equity (Trading Desk) Routes

All under `/equity` via `EquityLayout` wrapping `TerminalShell`.

| Route | Page | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|
| `/equity/stocks` | StockDetailPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/security` | SecurityHubPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/security/:ticker` | SecurityHubPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/commodities` | CommoditiesPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/forex` | ForexPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/hotlists` | HotlistsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/insider` | InsiderActivityPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/stocks/about` | AboutPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/dashboard` | DashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/heatmap` | MarketHeatmapPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/dividends` | DividendDashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/rs` | RelativeStrengthPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/data-quality` | DataQualityDashboard | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/screener` | ScreenerPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/factors` | FactorDashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/alpha-zoo` | AlphaZooPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/research-autopilot` | ResearchAutopilotPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/strategy-export` | StrategyExportPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/intelligence-timeline` | IntelligenceTimelinePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/portfolio` | PortfolioPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/portfolio/lab` | PortfolioLabPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/portfolio/lab/portfolios/:id` | PortfolioLabDetailPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/portfolio/lab/runs/:runId` | PortfolioLabRunReportPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/portfolio/lab/blends` | PortfolioLabBlendsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/mutual-funds` | MutualFundsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/bonds` | BondsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/watchlist` | WatchlistPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/news` | NewsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/alerts` | AlertsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | 🔍 Defect found |
| `/equity/paper` | PaperTradingPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/position-sizer` | PositionSizerPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/journal` | TradeJournalPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/shadow-account` | ShadowAccountPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/risk` | RiskDashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/correlation` | CorrelationDashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/stat-lab` | StatisticalLab | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/pair-trading` | PairTradingLabPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/oms` | OmsCompliancePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/ops` | OpsDashboardPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/plugins` | PluginsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/settings` | SettingsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/chart-workstation` | ChartWorkstationPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/research` | ResearchPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/mta` | MultiTimeframePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/dom` | DOMPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/tape` | TimeAndSalesPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/launchpad` | LaunchpadPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/launchpad/popout` | LaunchpadPopoutPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/compare` | SplitComparisonPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/yield-curve` | YieldCurveDashboard | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/bond-analytics` | BondAnalyticsCalculator | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/option-greeks` | OptionGreeksCalculator | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/economics` | EconomicTerminal | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/sector-rotation` | SectorRotationPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/crypto` | CryptoWorkspacePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/etf-analytics` | ETFAnalyticsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/cockpit` | CockpitDashboard | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/equity/saved-views` | SavedViewsPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |

---

## Options & Futures Routes

All under `/fno` via `FnoLayout` wrapping `TerminalShell`.

| Route | Page | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|
| `/fno` | OptionChainPage | ✅ Fixed | Bottom | ✅ OK | ✅ Fixed | ✅ OK | Required | ✅ Verified |
| `/fno/greeks` | GreeksPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/futures` | FuturesPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/oi` | OIAnalysisPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/strategy` | StrategyPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/pcr` | PCRPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/flow` | OptionsFlowPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/heatmap` | HeatmapPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/expiry` | ExpiryPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |
| `/fno/about` | FnoAboutPage | ✅ Fixed | Bottom | ⬜ | ⬜ | ⬜ | Required | ✅ Fixed (via shared FnoLayout) |

### Options & Futures fixes applied (PR #10)
- Compact filter toolbar on mobile
- Filter bottom sheet with focus trap
- Symbol validation (N225/.NS/.BO rejection)
- No-expiry empty state
- Em dashes for missing metrics
- 2-column summary grid on phone
- all routes share the fixed FnoLayout

---

## Backtesting Routes

All under `/backtesting` via `BacktestingLayout`.

| Route | Page | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|
| `/backtesting` | BacktestingPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/model-lab` | ModelLabPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/model-lab/experiments/:id` | ModelLabExperimentDetailPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/model-lab/runs/:runId` | ModelLabRunReportPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/model-lab/compare` | ModelLabComparePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/model-governance` | ModelGovernancePage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/algorithm-framework` | AlgorithmFrameworkLab | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |
| `/backtesting/portfolio-optimizer` | PortfolioOptimizer | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |

---

## Account Routes

| Route | Page | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|
| `/account` | AccountPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ Not reviewed |

---

## Standalone Sub-Routes

| Route | Page | Overflow | Nav | Loading | Empty | Error | Auth | Status |
|---|---|---|---|---|---|---|---|---|
| `/cockpit` | → `/equity/cockpit` | N/A | Bottom | N/A | N/A | N/A | Required | ⬜ |
| `/model-lab` | ModelLabPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ |
| `/portfolio-lab` | PortfolioLabPage | 🔍 | Bottom | ⬜ | ⬜ | ⬜ | Required | ⬜ |
| `*` (404) | → `/` | N/A | N/A | N/A | N/A | N/A | N/A | ⬜ |

---

## Shared Components Status

| Component | File | Mobile Status |
|---|---|---|
| TerminalShell | `components/layout/TerminalShell.tsx` | ✅ Fixed (responsive container) |
| IconRail | `components/layout/IconRail.tsx` | ✅ OK (hidden on mobile) |
| MobileBottomNav | `components/layout/MobileBottomNav.tsx` | ✅ Fixed (5 items, 44px targets) |
| StatusBar | `components/layout/StatusBar.tsx` | ✅ Fixed (safe-area padding) |
| TopBar | `components/layout/TopBar.tsx` | 🔍 Desktop route strip needs mobile hide |
| TickerTape | `components/layout/TickerTape.tsx` | ✅ OK (scrollable container) |
| CommandBar | `components/layout/CommandBar.tsx` | 🔍 Needs compact search button |
| MarketStatusBar | `components/layout/MarketStatusBar.tsx` | ✅ Fixed (single-column mobile) |
| Breadcrumbs | `components/layout/TopBar.tsx` (inline) | 🔍 Needs mobile collapse |
| AgentLauncher | `agent/components/AgentLauncher.tsx` | ✅ Fixed (hidden on mobile) |
| AgentConsole | `agent/components/AgentConsole.tsx` | ✅ OK (fixed panel) |
| AuthContext | `contexts/AuthContext.tsx` | 🔍 Needs user-friendly error handling |
| useQuotesStream | `realtime/useQuotesStream.ts` | 🔍 Needs dynamic WS URL |
| ChartWorkstation | `components/chart-workstation/` | 🔍 Zero-size guard needed |
| PWA manifest | `public/manifest.json` | 🔍 Needs audit |
| Service worker | `public/sw.js` | 🔍 Needs audit |

---

## Route Count Summary

| Category | Count | Fixed | Defect | Not Reviewed | Blocked |
|---|---|---|---|---|---|
| Public/Auth | 3 | 1 | 0 | 2 | 0 |
| Home | 2 | 2 | 0 | 0 | 0 |
| Equity | 56 | 0 | 3 | 53 | 0 |
| Options & Futures | 10 | 10 | 0 | 0 | 0 |
| Backtesting | 8 | 0 | 0 | 8 | 0 |
| Account | 1 | 0 | 0 | 1 | 0 |
| Standalone | 4 | 0 | 0 | 4 | 0 |
| **Total** | **84** | **13** | **3** | **68** | **0** |
