export type NavCard = {
  label: string;
  to: string;
  badge: string;
};

export const NAV_CARD_SECTIONS: Array<{ title: string; cards: NavCard[] }> = [
  {
    title: "MARKETS",
    cards: [
      { label: "Equity", to: "/equity/stocks", badge: "M1" },
      { label: "Options & Futures", to: "/fno", badge: "FO" },
      { label: "Crypto", to: "/equity/crypto", badge: "CR" },
      { label: "Economics", to: "/equity/economics", badge: "EC" },
      { label: "Yield Curve", to: "/equity/yield-curve", badge: "YC" },
      { label: "Rotation", to: "/equity/sector-rotation", badge: "ROT" },
      { label: "Heatmap", to: "/equity/heatmap", badge: "HM" },
    ],
  },
  {
    title: "DERIVATIVES",
    cards: [
      { label: "Option Chain", to: "/fno", badge: "OC" },
      { label: "Greeks", to: "/fno/greeks", badge: "GR" },
      { label: "Futures", to: "/fno/futures", badge: "FUT" },
      { label: "OI Analysis", to: "/fno/oi", badge: "OI" },
      { label: "Strategy", to: "/fno/strategy", badge: "STR" },
      { label: "PCR", to: "/fno/pcr", badge: "PCR" },
      { label: "Options Flow", to: "/fno/flow", badge: "FLW" },
      { label: "Options & Futures Heatmap", to: "/fno/heatmap", badge: "FHM" },
      { label: "Expiry", to: "/fno/expiry", badge: "EXP" },
    ],
  },
  {
    title: "RESEARCH",
    cards: [
      { label: "Security Hub", to: "/equity/security", badge: "SH" },
      { label: "Screener", to: "/equity/screener", badge: "F2" },
      { label: "Saved Views", to: "/equity/saved-views", badge: "SV" },
      { label: "Factors", to: "/equity/factors", badge: "FAC" },
      { label: "Alpha Zoo", to: "/equity/alpha-zoo", badge: "AZ" },
      { label: "Strategy Export", to: "/equity/strategy-export", badge: "SE" },
      { label: "Intelligence", to: "/equity/intelligence-timeline", badge: "INT" },
      { label: "Hotlists", to: "/equity/hotlists", badge: "HOT" },
      { label: "Insider", to: "/equity/insider", badge: "INS" },
      { label: "Compare", to: "/equity/compare", badge: "CMP" },
    ],
  },
  {
    title: "LABS",
    cards: [
      { label: "Backtesting", to: "/backtesting", badge: "F9" },
      { label: "Model Lab", to: "/backtesting/model-lab", badge: "ML" },
      { label: "Portfolio Lab", to: "/equity/portfolio/lab", badge: "PL" },
      { label: "Model Compare", to: "/backtesting/model-lab/compare", badge: "MC" },
      { label: "Blends", to: "/equity/portfolio/lab/blends", badge: "BL" },
      { label: "Stat Lab", to: "/equity/stat-lab", badge: "SL" },
    ],
  },
  {
    title: "PORTFOLIO",
    cards: [
      { label: "Holdings", to: "/equity/portfolio", badge: "F3" },
      { label: "Risk Desk", to: "/equity/risk", badge: "RSK" },
      { label: "Correlation", to: "/equity/correlation", badge: "COR" },
      { label: "Paper", to: "/equity/paper", badge: "PP" },
      { label: "Dividends", to: "/equity/dividends", badge: "DIV" },
      { label: "Mutual Funds", to: "/equity/mutual-funds", badge: "MF" },
      { label: "ETF Analytics", to: "/equity/etf-analytics", badge: "ETF" },
    ],
  },
  {
    title: "INTEL",
    cards: [
      { label: "News", to: "/equity/news", badge: "NW" },
      { label: "Alerts", to: "/equity/alerts", badge: "AL" },
      { label: "Watchlist", to: "/equity/watchlist", badge: "F4" },
      { label: "Relative Str", to: "/equity/rs", badge: "RS" },
      { label: "Data Quality", to: "/equity/data-quality", badge: "DQ" },
    ],
  },
  {
    title: "WORKSPACE",
    cards: [
      { label: "Launchpad", to: "/equity/launchpad", badge: "LP" },
      { label: "Workstation", to: "/equity/chart-workstation", badge: "WS" },
      { label: "Cockpit", to: "/equity/cockpit", badge: "CP" },
      { label: "Plugins", to: "/equity/plugins", badge: "PLG" },
      { label: "Settings", to: "/equity/settings", badge: "F6" },
      { label: "Account", to: "/account", badge: "ACC" },
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
