export type NavCard = {
  label: string;
  to: string;
  badge: string;
  description: string;
};

export const NAV_CARD_SECTIONS: Array<{ title: string; cards: NavCard[] }> = [
  {
    title: "Markets",
    cards: [
      { label: "Equity", to: "/equity/stocks", badge: "M1", description: "Browse and quote U.S. equities" },
      { label: "Options & Futures", to: "/fno", badge: "FO", description: "Derivatives desk and chains" },
      { label: "Crypto", to: "/equity/crypto", badge: "CR", description: "Crypto market workspace" },
      { label: "Economics", to: "/equity/economics", badge: "EC", description: "Macro and economic calendar" },
      { label: "Yield Curve", to: "/equity/yield-curve", badge: "YC", description: "Rates and yield curve tools" },
      { label: "Sector rotation", to: "/equity/sector-rotation", badge: "ROT", description: "Sector leadership and rotation" },
      { label: "Heatmap", to: "/equity/heatmap", badge: "HM", description: "Market breadth heatmap" },
    ],
  },
  {
    title: "Derivatives",
    cards: [
      { label: "Option chain", to: "/fno", badge: "OC", description: "Live option chain and strikes" },
      { label: "Greeks", to: "/fno/greeks", badge: "GR", description: "Option Greeks and risk" },
      { label: "Futures", to: "/fno/futures", badge: "FUT", description: "Futures quotes and rolls" },
      { label: "Open interest analysis", to: "/fno/oi", badge: "OI", description: "Open interest positioning" },
      { label: "Strategy", to: "/fno/strategy", badge: "STR", description: "Option strategy builder" },
      { label: "Put/call ratio", to: "/fno/pcr", badge: "PCR", description: "Put/call ratio sentiment" },
      { label: "Options flow", to: "/fno/flow", badge: "FLW", description: "Unusual options flow" },
      { label: "Options & Futures heatmap", to: "/fno/heatmap", badge: "FHM", description: "Derivatives exposure heatmap" },
      { label: "Expiry", to: "/fno/expiry", badge: "EXP", description: "Expiry calendar and rolls" },
    ],
  },
  {
    title: "Research",
    cards: [
      { label: "Security hub", to: "/equity/security", badge: "SH", description: "Single-name research hub" },
      { label: "Screener", to: "/equity/screener", badge: "F2", description: "Filter and rank equities" },
      { label: "Saved views", to: "/equity/saved-views", badge: "SV", description: "Saved screener and desk views" },
      { label: "Factors", to: "/equity/factors", badge: "FAC", description: "Factor research workspace" },
      { label: "Alpha Zoo", to: "/equity/alpha-zoo", badge: "AZ", description: "Alpha and signal library" },
      { label: "Strategy export", to: "/equity/strategy-export", badge: "SE", description: "Export strategies and signals" },
      { label: "Intelligence", to: "/equity/intelligence-timeline", badge: "INT", description: "Intelligence timeline" },
      { label: "Hotlists", to: "/equity/hotlists", badge: "HOT", description: "Curated market hotlists" },
      { label: "Insider", to: "/equity/insider", badge: "INS", description: "Insider transaction activity" },
      { label: "Compare", to: "/equity/compare", badge: "CMP", description: "Compare symbols side by side" },
    ],
  },
  {
    title: "Labs",
    cards: [
      { label: "Backtesting", to: "/backtesting", badge: "F9", description: "Run and review backtests" },
      { label: "Model lab", to: "/backtesting/model-lab", badge: "ML", description: "Model development lab" },
      { label: "Portfolio lab", to: "/equity/portfolio/lab", badge: "PL", description: "Portfolio construction lab" },
      { label: "Model compare", to: "/backtesting/model-lab/compare", badge: "MC", description: "Compare model runs" },
      { label: "Blends", to: "/equity/portfolio/lab/blends", badge: "BL", description: "Portfolio blend experiments" },
      { label: "Stat lab", to: "/equity/stat-lab", badge: "SL", description: "Statistical analysis lab" },
    ],
  },
  {
    title: "Portfolio",
    cards: [
      { label: "Holdings", to: "/equity/portfolio", badge: "F3", description: "Positions and valuation" },
      { label: "Risk desk", to: "/equity/risk", badge: "RSK", description: "Exposure and risk limits" },
      { label: "Correlation", to: "/equity/correlation", badge: "COR", description: "Correlation matrix" },
      { label: "Paper trading", to: "/equity/paper", badge: "PP", description: "Paper portfolio and orders" },
      { label: "Dividends", to: "/equity/dividends", badge: "DIV", description: "Dividend income tracking" },
      { label: "Mutual funds", to: "/equity/mutual-funds", badge: "MF", description: "Mutual fund analytics" },
      { label: "ETF analytics", to: "/equity/etf-analytics", badge: "ETF", description: "ETF holdings and flows" },
    ],
  },
  {
    title: "Intel",
    cards: [
      { label: "News", to: "/equity/news", badge: "NW", description: "Headlines and sentiment" },
      { label: "Alerts", to: "/equity/alerts", badge: "AL", description: "Price and condition alerts" },
      { label: "Watchlist", to: "/equity/watchlist", badge: "F4", description: "Tracked symbols" },
      { label: "Relative strength", to: "/equity/rs", badge: "RS", description: "Relative strength rankings" },
      { label: "Data quality", to: "/equity/data-quality", badge: "DQ", description: "Feed health and data checks" },
    ],
  },
  {
    title: "Workspace",
    cards: [
      { label: "Launchpad", to: "/equity/launchpad", badge: "LP", description: "Multi-panel trading layout" },
      { label: "Workstation", to: "/equity/chart-workstation", badge: "WS", description: "Chart analysis workstation" },
      { label: "Cockpit", to: "/equity/cockpit", badge: "CP", description: "Desk cockpit overview" },
      { label: "Plugins", to: "/equity/plugins", badge: "PLG", description: "Installed plugins" },
      { label: "Settings", to: "/equity/settings", badge: "F6", description: "Appearance and preferences" },
      { label: "Account", to: "/account", badge: "ACC", description: "Account and provider status" },
    ],
  },
];

export function slugifyNav(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function findNavCardByRoute(to: string): NavCard | null {
  for (const section of NAV_CARD_SECTIONS) {
    const match = section.cards.find((card) => card.to === to);
    if (match) return match;
  }
  return null;
}
