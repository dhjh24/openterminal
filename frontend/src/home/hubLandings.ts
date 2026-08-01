import type { DesktopHubId } from "./mobileNav";
import type { NavCard } from "./navCards";

export type HubTool = NavCard;

export type HubLandingConfig = {
  id: Exclude<DesktopHubId, "home">;
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  primary: HubTool;
  secondary?: HubTool;
  sections: Array<{ title: string; tools: HubTool[] }>;
};

export const HUB_LANDING_CONFIGS: Record<Exclude<DesktopHubId, "home">, HubLandingConfig> = {
  markets: {
    id: "markets",
    path: "/equity/markets",
    title: "Markets",
    eyebrow: "Markets hub",
    description: "Browse equities, derivatives, crypto, and macro desks from one place.",
    primary: {
      label: "Equity quotes",
      to: "/equity/stocks",
      badge: "EQ",
      description: "U.S. equity browse and quote",
    },
    secondary: {
      label: "Options & Futures",
      to: "/fno",
      badge: "FO",
      description: "Derivatives desk and chains",
    },
    sections: [
      {
        title: "Cash markets",
        tools: [
          { label: "Equity", to: "/equity/stocks", badge: "M1", description: "Browse and quote U.S. equities" },
          { label: "Crypto", to: "/equity/crypto", badge: "CR", description: "Crypto market workspace" },
          { label: "Heatmap", to: "/equity/heatmap", badge: "HM", description: "Market breadth heatmap" },
          { label: "Sector rotation", to: "/equity/sector-rotation", badge: "ROT", description: "Sector leadership and rotation" },
          { label: "News", to: "/equity/news", badge: "NW", description: "Headlines and sentiment" },
        ],
      },
      {
        title: "Macro & rates",
        tools: [
          { label: "Economics", to: "/equity/economics", badge: "EC", description: "Macro and economic calendar" },
          { label: "Yield Curve", to: "/equity/yield-curve", badge: "YC", description: "Rates and yield curve tools" },
          { label: "Bonds", to: "/equity/bonds", badge: "BND", description: "Fixed income browse" },
          { label: "Commodities", to: "/equity/commodities", badge: "CMD", description: "Commodity markets" },
          { label: "Forex", to: "/equity/forex", badge: "FX", description: "FX pairs and crosses" },
        ],
      },
      {
        title: "Derivatives",
        tools: [
          { label: "Option chain", to: "/fno", badge: "OC", description: "Live option chain and strikes" },
          { label: "Greeks", to: "/fno/greeks", badge: "GR", description: "Option Greeks and risk" },
          { label: "Futures", to: "/fno/futures", badge: "FUT", description: "Futures quotes and rolls" },
          { label: "Put/call ratio", to: "/fno/pcr", badge: "PCR", description: "Put/call ratio sentiment" },
          { label: "Options flow", to: "/fno/flow", badge: "FLW", description: "Unusual options flow" },
        ],
      },
    ],
  },
  trade: {
    id: "trade",
    path: "/equity/trade",
    title: "Trade",
    eyebrow: "Trade hub",
    description: "Charts, watchlists, paper trading, and execution-adjacent tools.",
    primary: {
      label: "Open Workstation",
      to: "/equity/chart-workstation",
      badge: "WS",
      description: "Chart analysis workstation",
    },
    secondary: {
      label: "Watchlist",
      to: "/equity/watchlist",
      badge: "WL",
      description: "Tracked symbols",
    },
    sections: [
      {
        title: "Execution path",
        tools: [
          { label: "Workstation", to: "/equity/chart-workstation", badge: "WS", description: "Chart analysis workstation" },
          { label: "Watchlist", to: "/equity/watchlist", badge: "F4", description: "Tracked symbols" },
          { label: "Paper trading", to: "/equity/paper", badge: "PP", description: "Paper portfolio and orders" },
          { label: "Alerts", to: "/equity/alerts", badge: "AL", description: "Price and condition alerts" },
          { label: "Launchpad", to: "/equity/launchpad", badge: "LP", description: "Multi-panel trading layout" },
        ],
      },
      {
        title: "Market microstructure",
        tools: [
          { label: "Tape", to: "/equity/tape", badge: "T", description: "Time and sales" },
          { label: "Depth of market", to: "/equity/dom", badge: "D", description: "Order book depth" },
          { label: "Position sizer", to: "/equity/position-sizer", badge: "PS", description: "Size trades from risk" },
          { label: "Journal", to: "/equity/journal", badge: "J", description: "Trade journal" },
          { label: "Shadow account", to: "/equity/shadow-account", badge: "SA", description: "Shadow account and bias checks" },
        ],
      },
    ],
  },
  research: {
    id: "research",
    path: "/equity/research-desk",
    title: "Research",
    eyebrow: "Research hub",
    description: "Screeners, backtests, factors, and model work without hunting the launcher.",
    primary: {
      label: "Open Screener",
      to: "/equity/screener",
      badge: "F2",
      description: "Filter and rank equities",
    },
    secondary: {
      label: "Run Backtest",
      to: "/backtesting",
      badge: "F9",
      description: "Run and review backtests",
    },
    sections: [
      {
        title: "Discovery",
        tools: [
          { label: "Screener", to: "/equity/screener", badge: "F2", description: "Filter and rank equities" },
          { label: "Security hub", to: "/equity/security", badge: "SH", description: "Single-name research hub" },
          { label: "Factors", to: "/equity/factors", badge: "FAC", description: "Factor research workspace" },
          { label: "Alpha Zoo", to: "/equity/alpha-zoo", badge: "AZ", description: "Alpha and signal library" },
          { label: "Hotlists", to: "/equity/hotlists", badge: "HOT", description: "Curated market hotlists" },
        ],
      },
      {
        title: "Models & labs",
        tools: [
          { label: "Backtesting", to: "/backtesting", badge: "F9", description: "Run and review backtests" },
          { label: "Model lab", to: "/backtesting/model-lab", badge: "ML", description: "Model development lab" },
          { label: "Research Autopilot", to: "/equity/research-autopilot", badge: "RA", description: "AI-assisted research" },
          { label: "Stat lab", to: "/equity/stat-lab", badge: "SL", description: "Statistical analysis lab" },
          { label: "Pair trading", to: "/equity/pair-trading", badge: "PT", description: "Pairs and relative value" },
        ],
      },
      {
        title: "Intel",
        tools: [
          { label: "Intelligence", to: "/equity/intelligence-timeline", badge: "INT", description: "Intelligence timeline" },
          { label: "Compare", to: "/equity/compare", badge: "CMP", description: "Compare symbols side by side" },
          { label: "Insider", to: "/equity/insider", badge: "INS", description: "Insider transaction activity" },
          { label: "Strategy export", to: "/equity/strategy-export", badge: "SE", description: "Export strategies and signals" },
          { label: "Document research", to: "/equity/research", badge: "DOC", description: "Research document ingest" },
        ],
      },
    ],
  },
  portfolio: {
    id: "portfolio",
    path: "/equity/portfolio-desk",
    title: "Portfolio",
    eyebrow: "Portfolio hub",
    description: "Holdings, risk, correlation, and income tools for the book.",
    primary: {
      label: "Open Holdings",
      to: "/equity/portfolio",
      badge: "F3",
      description: "Positions and valuation",
    },
    secondary: {
      label: "Open Risk",
      to: "/equity/risk",
      badge: "RSK",
      description: "Exposure and risk limits",
    },
    sections: [
      {
        title: "Book",
        tools: [
          { label: "Holdings", to: "/equity/portfolio", badge: "F3", description: "Positions and valuation" },
          { label: "Portfolio lab", to: "/equity/portfolio/lab", badge: "PL", description: "Portfolio construction lab" },
          { label: "Paper trading", to: "/equity/paper", badge: "PP", description: "Paper portfolio and orders" },
          { label: "Dividends", to: "/equity/dividends", badge: "DIV", description: "Dividend income tracking" },
        ],
      },
      {
        title: "Risk & analytics",
        tools: [
          { label: "Risk desk", to: "/equity/risk", badge: "RSK", description: "Exposure and risk limits" },
          { label: "Correlation", to: "/equity/correlation", badge: "COR", description: "Correlation matrix" },
          { label: "ETF analytics", to: "/equity/etf-analytics", badge: "ETF", description: "ETF holdings and flows" },
          { label: "Mutual funds", to: "/equity/mutual-funds", badge: "MF", description: "Mutual fund analytics" },
        ],
      },
    ],
  },
};

export function getHubLandingConfig(id: Exclude<DesktopHubId, "home">): HubLandingConfig {
  return HUB_LANDING_CONFIGS[id];
}
