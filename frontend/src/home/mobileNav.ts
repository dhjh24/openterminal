export type MobileHubId = "home" | "markets" | "trade" | "portfolio";

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

export type MoreSectionItem =
  | { kind: "link"; label: string; path: string }
  | { kind: "agent"; label: string };

export type MoreSection = {
  id: string;
  title: string;
  items: MoreSectionItem[];
};

/** Grouped More destinations — Research, Alerts, Tools, Agent, Settings, Account */
export const MORE_SECTIONS: MoreSection[] = [
  {
    id: "research",
    title: "Research",
    items: [
      { kind: "link", label: "Screener", path: "/equity/screener" },
      { kind: "link", label: "Backtesting", path: "/backtesting" },
      { kind: "link", label: "Factors", path: "/equity/factors" },
      { kind: "link", label: "Model Lab", path: "/backtesting/model-lab" },
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
      { kind: "link", label: "Data Quality", path: "/equity/data-quality" },
      { kind: "link", label: "OMS", path: "/equity/oms" },
      { kind: "link", label: "Plugins", path: "/equity/plugins" },
    ],
  },
  {
    id: "agent",
    title: "Agent",
    items: [{ kind: "agent", label: "Open Agent" }],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { kind: "link", label: "Settings", path: "/equity/settings" },
      { kind: "link", label: "Appearance", path: "/equity/settings" },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [{ kind: "link", label: "Account", path: "/account" }],
  },
];

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isMobileHubActive(hubId: MobileHubId, pathname: string): boolean {
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
        startsWithPath(path, "/equity/journal") ||
        startsWithPath(path, "/equity/orders")
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

export function isMoreDestinationActive(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (MOBILE_HUBS.some((hub) => isMobileHubActive(hub.id, path))) return false;
  return MORE_SECTIONS.some((section) =>
    section.items.some((item) => item.kind === "link" && startsWithPath(path, item.path)),
  );
}
