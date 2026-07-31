export type WorkspacePreset = "trader" | "quant" | "pm" | "risk" | "ops";

export const WORKSPACE_PRESET_STORAGE_KEY = "ot:workspace:preset:v1";
export const WORKSPACE_ONBOARDING_STORAGE_KEY = "ot:workspace:onboarding:v1";

/** Layout-scoped shell keys that should stay aligned with the global workspace preset. */
export const WORKSPACE_SHELL_PRESET_STORAGE_KEYS = [
  WORKSPACE_PRESET_STORAGE_KEY,
  "ot:shell:equity:preset",
  "ot:shell:fno:preset",
  "ot:shell:backtesting:preset",
  "ot:shell:account:preset",
] as const;

export type WorkspacePresetConfig = {
  id: WorkspacePreset;
  label: string;
  purpose: string;
  landing: {
    headline: string;
    description: string;
    primaryRoute: string;
    primaryLabel: string;
  };
  homeSections: string[];
  cockpitPanels: string[];
  quickLinks: Array<{ to: string; label: string }>;
  launchpadLayoutId: string;
  launchpadPanels: Array<{ type: string; title: string; x: number; y: number; w: number; h: number; symbol?: string }>;
};

export type WorkspaceFirstUseChoice = {
  id: string;
  label: string;
  description: string;
  preset: WorkspacePreset;
};

export const WORKSPACE_FIRST_USE_CHOICES: WorkspaceFirstUseChoice[] = [
  {
    id: "active-trading",
    label: "Active trading",
    description: "Intraday charts, watchlists, alerts, and execution paths.",
    preset: "trader",
  },
  {
    id: "options-trading",
    label: "Options trading",
    description: "Chains, Greeks, and derivatives-focused decision loops.",
    preset: "trader",
  },
  {
    id: "research",
    label: "Research and backtesting",
    description: "Screeners, backtests, factors, and model work.",
    preset: "quant",
  },
  {
    id: "portfolio-risk",
    label: "Portfolio and risk",
    description: "Holdings, exposure, allocation, and risk monitors.",
    preset: "pm",
  },
  {
    id: "platform-ops",
    label: "Platform operations",
    description: "Data quality, feeds, OMS, and desk controls.",
    preset: "ops",
  },
];

export const WORKSPACE_PRESET_CONFIGS: Record<WorkspacePreset, WorkspacePresetConfig> = {
  trader: {
    id: "trader",
    label: "Trader",
    purpose: "Active trading desk for charts, watchlist, alerts, and paper execution.",
    landing: {
      headline: "Trading Desk",
      description: "Fast chart, tape, watchlist, alerts, and execution paths for intraday decisions.",
      primaryRoute: "/equity/chart-workstation",
      primaryLabel: "Open Workstation",
    },
    homeSections: ["portfolio", "health", "news", "results", "heatmap", "timeline", "launch"],
    cockpitPanels: ["priority", "results", "focus", "news", "sentiment", "portfolio", "risk", "events", "heatmap", "timeline"],
    quickLinks: [
      { to: "/equity/chart-workstation", label: "Charts" },
      { to: "/equity/stocks", label: "Quote" },
      { to: "/equity/watchlist", label: "Watchlist" },
      { to: "/equity/alerts", label: "Alerts" },
      { to: "/equity/paper", label: "Paper" },
      { to: "/equity/tape", label: "Tape" },
    ],
    launchpadLayoutId: "preset-trader",
    launchpadPanels: [
      { type: "chart", title: "Active Chart", x: 0, y: 0, w: 7, h: 6, symbol: "AAPL" },
      { type: "watchlist", title: "Watchlist", x: 7, y: 0, w: 5, h: 4 },
      { type: "order-book", title: "Order Book", x: 7, y: 4, w: 5, h: 3, symbol: "AAPL" },
      { type: "news-feed", title: "News", x: 0, y: 6, w: 7, h: 4, symbol: "AAPL" },
      { type: "alerts", title: "Alerts", x: 7, y: 7, w: 5, h: 3 },
    ],
  },
  quant: {
    id: "quant",
    label: "Quant",
    purpose: "Research desk for screeners, backtests, factors, and model exploration.",
    landing: {
      headline: "Quant Research",
      description: "Screener, backtesting, model lab, factor, and workstation surfaces for research loops.",
      primaryRoute: "/backtesting",
      primaryLabel: "Run Backtest",
    },
    homeSections: ["results", "timeline", "launch", "portfolio", "news"],
    cockpitPanels: ["priority", "results", "focus", "sentiment", "events", "timeline"],
    quickLinks: [
      { to: "/equity/screener", label: "Screener" },
      { to: "/backtesting", label: "Backtest" },
      { to: "/backtesting/model-lab", label: "Model Lab" },
      { to: "/equity/factors", label: "Factors" },
      { to: "/equity/chart-workstation", label: "Charts" },
      { to: "/equity/rs", label: "RS" },
    ],
    launchpadLayoutId: "preset-quant",
    launchpadPanels: [
      { type: "screener-results", title: "Screener", x: 0, y: 0, w: 6, h: 5 },
      { type: "chart", title: "Signal Chart", x: 6, y: 0, w: 6, h: 5, symbol: "AAPL" },
      { type: "market-pulse", title: "Market Pulse", x: 0, y: 5, w: 4, h: 5 },
      { type: "sector-rotation", title: "Rotation", x: 4, y: 5, w: 4, h: 5 },
      { type: "ai-research", title: "Research Notes", x: 8, y: 5, w: 4, h: 5 },
    ],
  },
  pm: {
    id: "pm",
    label: "PM",
    purpose: "Portfolio management desk for holdings, allocation, and catalysts.",
    landing: {
      headline: "Portfolio Command",
      description: "Portfolio, exposure, risk, catalysts, and benchmark context for allocation decisions.",
      primaryRoute: "/equity/portfolio",
      primaryLabel: "Open Portfolio",
    },
    homeSections: ["portfolio", "heatmap", "timeline", "news", "launch"],
    cockpitPanels: ["priority", "portfolio", "risk", "events", "heatmap", "timeline", "news"],
    quickLinks: [
      { to: "/equity/portfolio", label: "Portfolio" },
      { to: "/equity/portfolio/lab", label: "Lab" },
      { to: "/equity/risk", label: "Risk" },
      { to: "/equity/correlation", label: "Corr" },
      { to: "/equity/news", label: "News" },
      { to: "/equity/security", label: "Security" },
    ],
    launchpadLayoutId: "preset-pm",
    launchpadPanels: [
      { type: "portfolio-summary", title: "Holdings", x: 0, y: 0, w: 6, h: 5 },
      { type: "portfolio-performance", title: "Performance", x: 6, y: 0, w: 6, h: 5 },
      { type: "portfolio-allocation", title: "Allocation", x: 0, y: 5, w: 6, h: 5 },
      { type: "risk-metrics", title: "Risk", x: 6, y: 5, w: 6, h: 5 },
    ],
  },
  risk: {
    id: "risk",
    label: "Risk",
    purpose: "Risk console for exposure, stress, correlation, and limit monitoring.",
    landing: {
      headline: "Risk Console",
      description: "Exposure, stress, correlation, volatility, and limit-monitoring surfaces first.",
      primaryRoute: "/equity/risk",
      primaryLabel: "Open Risk",
    },
    homeSections: ["health", "heatmap", "portfolio", "timeline", "launch"],
    cockpitPanels: ["priority", "risk", "portfolio", "heatmap", "events", "timeline"],
    quickLinks: [
      { to: "/equity/risk", label: "Risk" },
      { to: "/equity/correlation", label: "Corr" },
      { to: "/equity/ops", label: "Ops" },
      { to: "/equity/alerts", label: "Alerts" },
      { to: "/equity/portfolio", label: "Portfolio" },
      { to: "/equity/heatmap", label: "Heatmap" },
    ],
    launchpadLayoutId: "preset-risk",
    launchpadPanels: [
      { type: "risk-metrics", title: "Risk Metrics", x: 0, y: 0, w: 6, h: 5 },
      { type: "heatmap", title: "Exposure Heatmap", x: 6, y: 0, w: 6, h: 5 },
      { type: "alerts", title: "Limit Alerts", x: 0, y: 5, w: 4, h: 5 },
      { type: "portfolio-summary", title: "Portfolio", x: 4, y: 5, w: 4, h: 5 },
      { type: "market-pulse", title: "Market Pulse", x: 8, y: 5, w: 4, h: 5 },
    ],
  },
  ops: {
    id: "ops",
    label: "Ops",
    purpose: "Operations desk for data quality, feed health, OMS, and plugins.",
    landing: {
      headline: "Operations Desk",
      description: "Data quality, feed health, OMS, plugins, and operational controls first.",
      primaryRoute: "/equity/ops",
      primaryLabel: "Open Ops",
    },
    homeSections: ["health", "launch", "news", "portfolio"],
    cockpitPanels: ["priority", "news", "events", "portfolio", "risk"],
    quickLinks: [
      { to: "/equity/ops", label: "Ops" },
      { to: "/equity/data-quality", label: "Data" },
      { to: "/equity/oms", label: "OMS" },
      { to: "/equity/plugins", label: "Plugins" },
      { to: "/equity/settings", label: "Settings" },
      { to: "/equity/alerts", label: "Alerts" },
    ],
    launchpadLayoutId: "preset-ops",
    launchpadPanels: [
      { type: "market-pulse", title: "Feed Pulse", x: 0, y: 0, w: 6, h: 5 },
      { type: "alerts", title: "Ops Alerts", x: 6, y: 0, w: 6, h: 5 },
      { type: "news-feed", title: "Incident Wire", x: 0, y: 5, w: 6, h: 5 },
      { type: "watchlist", title: "Coverage", x: 6, y: 5, w: 6, h: 5 },
    ],
  },
};

function isWorkspacePreset(value: unknown): value is WorkspacePreset {
  return value === "trader" || value === "quant" || value === "pm" || value === "risk" || value === "ops";
}

export function readWorkspacePreset(): WorkspacePreset {
  if (typeof window === "undefined") return "trader";
  const raw = localStorage.getItem(WORKSPACE_PRESET_STORAGE_KEY);
  if (!raw) return "trader";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isWorkspacePreset(parsed)) return parsed;
  } catch {
    // Legacy unquoted values.
  }
  return isWorkspacePreset(raw) ? raw : "trader";
}

export function writeWorkspacePreset(preset: WorkspacePreset): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(preset);
    for (const key of WORKSPACE_SHELL_PRESET_STORAGE_KEYS) {
      localStorage.setItem(key, serialized);
    }
  } catch {
    // ignore storage failures
  }
}

export function getWorkspacePresetConfig(preset: WorkspacePreset): WorkspacePresetConfig {
  return WORKSPACE_PRESET_CONFIGS[preset] ?? WORKSPACE_PRESET_CONFIGS.trader;
}

export function hasCompletedWorkspaceOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(WORKSPACE_ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWorkspaceOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_ONBOARDING_STORAGE_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

export function announceWorkspacePresetChange(preset: WorkspacePreset, options?: { opened?: boolean }): void {
  if (typeof window === "undefined") return;
  const config = getWorkspacePresetConfig(preset);
  const message = options?.opened
    ? `Switched to ${config.label} workspace and opened ${config.landing.headline}.`
    : `Switched to ${config.label} workspace. Pinned tools and Mission Control sections updated. Primary action: ${config.landing.primaryLabel}.`;
  window.dispatchEvent(
    new CustomEvent("ot:alert-toast", {
      detail: {
        title: "Workspace updated",
        message,
        variant: "success",
        ttlMs: 5200,
      },
    }),
  );
  window.dispatchEvent(new CustomEvent("ot:preset-change", { detail: preset }));
}
