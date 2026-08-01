export type MobileHubId = "home" | "markets" | "trade" | "portfolio";
export type DesktopHubId = MobileHubId | "research";

export type ProductHub = {
  id: DesktopHubId;
  label: string;
  description: string;
  path: string;
};

/** Phone bottom tabs — Research stays under More for space. */
export type MobileHub = {
  id: MobileHubId;
  label: string;
  path: string;
};

export const MOBILE_HUBS: MobileHub[] = [
  { id: "home", label: "Home", path: "/home" },
  { id: "markets", label: "Markets", path: "/equity/stocks" },
  { id: "trade", label: "Trade", path: "/equity/chart-workstation" },
  { id: "portfolio", label: "Portfolio", path: "/equity/portfolio" },
];

/** Desktop primary rail — five product hubs from the Mission Control epic. */
export const DESKTOP_HUBS: ProductHub[] = [
  { id: "home", label: "Home", description: "Mission Control dashboard", path: "/home" },
  { id: "markets", label: "Markets", description: "Stocks, derivatives, crypto, and macro", path: "/equity/stocks" },
  { id: "trade", label: "Trade", description: "Charts, watchlist, paper trading, and orders", path: "/equity/chart-workstation" },
  { id: "research", label: "Research", description: "Screener, backtests, factors, and models", path: "/equity/screener" },
  { id: "portfolio", label: "Portfolio", description: "Holdings, risk, and performance", path: "/equity/portfolio" },
];

export type MoreSectionItem =
  | { kind: "link"; label: string; path: string }
  | { kind: "agent"; label: string };

export type MoreSection = {
  id: string;
  title: string;
  items: MoreSectionItem[];
};

/** Admin destinations grouped under Settings (routes unchanged). */
export const SETTINGS_ADMIN_LINKS: Array<{ label: string; path: string; description: string }> = [
  {
    label: "Appearance",
    path: "/equity/settings#appearance",
    description: "Density, contrast, chrome mode, and visual effects",
  },
  {
    label: "Data quality",
    path: "/equity/data-quality",
    description: "Feed health and backfill status",
  },
  {
    label: "Order management",
    path: "/equity/oms",
    description: "Orders, compliance, and OMS controls",
  },
  {
    label: "Plugins",
    path: "/equity/plugins",
    description: "Installed plugins and extensions",
  },
  {
    label: "Operations",
    path: "/equity/ops",
    description: "Desk operations and system controls",
  },
  {
    label: "Account",
    path: "/account",
    description: "Profile, providers, and sign-in",
  },
];

/** Grouped More destinations — Research, Alerts, Tools, Agent, Settings & Admin, Account */
export const MORE_SECTIONS: MoreSection[] = [
  {
    id: "research",
    title: "Research",
    items: [
      { kind: "link", label: "Screener", path: "/equity/screener" },
      { kind: "link", label: "Backtesting", path: "/backtesting" },
      { kind: "link", label: "Factors", path: "/equity/factors" },
      { kind: "link", label: "Model Lab", path: "/backtesting/model-lab" },
      { kind: "link", label: "Alpha Zoo", path: "/equity/alpha-zoo" },
      { kind: "link", label: "Intelligence", path: "/equity/intelligence-timeline" },
    ],
  },
  {
    id: "alerts",
    title: "Alerts",
    items: [{ kind: "link", label: "Alerts", path: "/equity/alerts" }],
  },
  {
    id: "tools",
    title: "Tools",
    items: [
      { kind: "link", label: "Launchpad", path: "/equity/launchpad" },
      { kind: "link", label: "Cockpit", path: "/equity/cockpit" },
      { kind: "link", label: "Watchlist", path: "/equity/watchlist" },
      { kind: "link", label: "Options & Futures", path: "/fno" },
      { kind: "link", label: "News", path: "/equity/news" },
    ],
  },
  {
    id: "agent",
    title: "Agent",
    items: [{ kind: "agent", label: "Open Agent" }],
  },
  {
    id: "settings-admin",
    title: "Settings & Admin",
    items: [
      { kind: "link", label: "Settings", path: "/equity/settings" },
      { kind: "link", label: "Appearance", path: "/equity/settings#appearance" },
      { kind: "link", label: "Data quality", path: "/equity/data-quality" },
      { kind: "link", label: "Order management", path: "/equity/oms" },
      { kind: "link", label: "Plugins", path: "/equity/plugins" },
      { kind: "link", label: "Operations", path: "/equity/ops" },
      { kind: "link", label: "Account", path: "/account" },
    ],
  },
];

function startsWithPath(pathname: string, prefix: string): boolean {
  const bare = prefix.split("#")[0] || prefix;
  return pathname === bare || pathname.startsWith(`${bare}/`);
}

export function isDesktopHubActive(hubId: DesktopHubId, pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;

  switch (hubId) {
    case "home":
      return path === "/home" || path === "/";
    case "markets":
      return (
        startsWithPath(path, "/equity/stocks") ||
        startsWithPath(path, "/equity/crypto") ||
        startsWithPath(path, "/equity/economics") ||
        startsWithPath(path, "/equity/heatmap") ||
        startsWithPath(path, "/equity/sector-rotation") ||
        startsWithPath(path, "/equity/yield-curve") ||
        startsWithPath(path, "/equity/commodities") ||
        startsWithPath(path, "/equity/forex") ||
        startsWithPath(path, "/equity/bonds") ||
        startsWithPath(path, "/equity/news") ||
        path === "/fno" ||
        startsWithPath(path, "/fno")
      );
    case "trade":
      return (
        startsWithPath(path, "/equity/chart-workstation") ||
        startsWithPath(path, "/equity/watchlist") ||
        startsWithPath(path, "/equity/paper") ||
        startsWithPath(path, "/equity/tape") ||
        startsWithPath(path, "/equity/dom") ||
        startsWithPath(path, "/equity/journal") ||
        startsWithPath(path, "/equity/orders") ||
        startsWithPath(path, "/equity/position-sizer") ||
        startsWithPath(path, "/equity/shadow-account")
      );
    case "research":
      return (
        startsWithPath(path, "/equity/screener") ||
        startsWithPath(path, "/equity/alpha-zoo") ||
        startsWithPath(path, "/equity/research-autopilot") ||
        startsWithPath(path, "/equity/strategy-export") ||
        startsWithPath(path, "/equity/factors") ||
        startsWithPath(path, "/equity/security") ||
        startsWithPath(path, "/equity/research") ||
        startsWithPath(path, "/equity/intelligence-timeline") ||
        startsWithPath(path, "/equity/stat-lab") ||
        startsWithPath(path, "/equity/pair-trading") ||
        startsWithPath(path, "/backtesting")
      );
    case "portfolio":
      return (
        startsWithPath(path, "/equity/portfolio") ||
        startsWithPath(path, "/equity/risk") ||
        startsWithPath(path, "/equity/correlation") ||
        startsWithPath(path, "/equity/dividends") ||
        startsWithPath(path, "/equity/etf-analytics") ||
        startsWithPath(path, "/equity/mutual-funds")
      );
    default:
      return false;
  }
}

export function isMobileHubActive(hubId: MobileHubId, pathname: string): boolean {
  return isDesktopHubActive(hubId, pathname);
}

export function isMoreDestinationActive(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (MOBILE_HUBS.some((hub) => isMobileHubActive(hub.id, path))) return false;
  return MORE_SECTIONS.some((section) =>
    section.items.some((item) => item.kind === "link" && startsWithPath(path, item.path)),
  );
}

export function isDesktopMoreDestinationActive(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (DESKTOP_HUBS.some((hub) => isDesktopHubActive(hub.id, path))) return false;
  return MORE_SECTIONS.some((section) =>
    section.items.some((item) => item.kind === "link" && startsWithPath(path, item.path)),
  );
}
