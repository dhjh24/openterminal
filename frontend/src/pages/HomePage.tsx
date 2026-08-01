import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchAlerts,
  fetchBacktestV1Presets,
  fetchLatestNews,
  fetchPaperPortfolios,
  fetchPaperPositions,
  fetchPortfolio,
  fetchPortfolioBenchmarkOverlay,
  fetchQuotesBatch,
  fetchWatchlist,
  type NewsLatestApiItem,
} from "../api/client";
import { fetchDashboardResults, type DashboardResults } from "../api/intelligence";
import { ExposureHeatmap } from "../components/dashboard/ExposureHeatmap";
import { GuidedEmptyState } from "../components/dashboard/GuidedEmptyState";
import { IntelligenceTimeline } from "../components/dashboard/IntelligenceTimeline";
import { ResultsSummaryCards } from "../components/dashboard/ResultsSummaryCards";
import { ActionQueueSection } from "../components/home/ActionQueueSection";
import { ExploreAllToolsDialog } from "../components/home/ExploreAllToolsDialog";
import { LiveClockStrip } from "../components/home/LiveClockStrip";
import { MarketHeatStrip, type MarketHeatStripItem } from "../components/home/MarketHeatStrip";
import { MetricCard } from "../components/home/MetricCard";
import { PortfolioMiniChart } from "../components/home/PortfolioMiniChart";
import { ProfileCompletionRing } from "../components/home/ProfileCompletionRing";
import { type QuickNavSection } from "../components/home/QuickNavGrid";
import { SystemHealthBar, type SystemHealthItem } from "../components/home/SystemHealthBar";
import { AiInsightCard } from "../components/terminal/AiInsightCard";
import { TerminalShell } from "../components/layout/TerminalShell";
import { useAuth } from "../contexts/AuthContext";
import { fetchChainSummary } from "../fno/api/fnoApi";
import { fetchCollectionBriefing } from "../api/client";
import { buildActionQueue } from "../home/actionQueue";
import { NAV_CARD_SECTIONS, slugifyNav } from "../home/navCards";
import { readRecentTools, recordRecentTool, type RecentTool } from "../home/recentTools";
import { useSettingsStore } from "../store/settingsStore";
import type { PortfolioItem } from "../types";
import { getWorkspacePresetConfig, readWorkspacePreset } from "../workspace/presets";

type MarketRow = {
  symbol: string;
  label?: string;
  ltp: number;
  chg: number;
  chgPct: number;
  flash: "up" | "down" | null;
};

type DashboardSnapshot = {
  equityValue: number | null;
  equityCost: number;
  equityPnl: number | null;
  holdingsCount: number;
  watchlistCount: number;
  watchlistDerivativesCount: number;
  backtestPresetCount: number;
  fnoSpot: number | null;
  fnoPcr: number | null;
  fnoSignal: string;
  updatedAt: number | null;
};

const TRANSITION_FLAG_KEY = "ot-terminal-transition";
const NEWS_LIMIT = 15;

const INITIAL_MARKET_ROWS: MarketRow[] = [
  { symbol: "^GSPC", label: "S&P 500", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "^DJI", label: "DOW", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "^IXIC", label: "NASDAQ", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "^RUT", label: "Russell 2000", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "GC=F", label: "GOLD", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "SI=F", label: "SILVER", ltp: 0, chg: 0, chgPct: 0, flash: null },
  { symbol: "CL=F", label: "CRUDE OIL", ltp: 0, chg: 0, chgPct: 0, flash: null },
];

const MARKET_PULSE_SYMBOLS = INITIAL_MARKET_ROWS.map((row) => row.symbol);

const FALLBACK_PERFORMANCE_POINTS = [
  243000, 242000, 244000, 245000, 244500, 246800, 247200, 246100, 247900, 248400,
  247700, 248900, 249500, 248100, 247800, 249100, 250300, 249800, 251200, 251900,
  251500, 252300, 253100, 252800, 253900, 254700, 254200, 255100, 255900, 256700,
];

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  equityValue: null,
  equityCost: 0,
  equityPnl: null,
  holdingsCount: 0,
  watchlistCount: 0,
  watchlistDerivativesCount: 0,
  backtestPresetCount: 0,
  fnoSpot: null,
  fnoPcr: null,
  fnoSignal: "NA",
  updatedAt: null,
};

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "USD --";
  return `USD ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatSignedUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "USD --";
  const sign = value >= 0 ? "+" : "-";
  return `${sign}USD ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCompactDateLabel(date: string): string {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return date;
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMetricTone(value: number | null): "accent" | "up" | "down" | "neutral" {
  if (value == null || !Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
}

function getSignalTone(signal: string): "accent" | "up" | "down" | "neutral" {
  const normalized = signal.trim().toUpperCase();
  if (normalized.includes("BULL")) return "up";
  if (normalized.includes("BEAR")) return "down";
  if (normalized === "NA") return "neutral";
  return "accent";
}

function getSystemTone(signal: string): SystemHealthItem["tone"] {
  const normalized = signal.trim().toUpperCase();
  if (normalized.includes("BULL")) return "ok";
  if (normalized.includes("BEAR")) return "warning";
  if (normalized === "NA") return "neutral";
  return "info";
}

function getSentimentClass(label?: string): string {
  if (label === "Bullish") return "text-terminal-pos";
  if (label === "Bearish") return "text-terminal-neg";
  return "text-terminal-muted";
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  const realtimeMode = useSettingsStore((s) => s.realtimeMode);
  const newsAutoRefresh = useSettingsStore((s) => s.newsAutoRefresh);
  const newsRefreshSec = useSettingsStore((s) => s.newsRefreshSec);

  const [marketRows, setMarketRows] = useState<MarketRow[]>(INITIAL_MARKET_ROWS);
  const [newsLog, setNewsLog] = useState<NewsLatestApiItem[]>([]);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [dashboardResults, setDashboardResults] = useState<DashboardResults | null>(null);
  const [activePreset, setActivePreset] = useState(readWorkspacePreset);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [performancePoints, setPerformancePoints] = useState<number[]>(FALLBACK_PERFORMANCE_POINTS);
  const [performanceBenchmarkPoints, setPerformanceBenchmarkPoints] = useState<number[]>([]);
  const [performanceLabels, setPerformanceLabels] = useState<string[]>([]);
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(INITIAL_MARKET_ROWS[0]?.symbol ?? null);
  const [initializing, setInitializing] = useState(() => sessionStorage.getItem(TRANSITION_FLAG_KEY) === "1");
  const [showDeskSettings, setShowDeskSettings] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [recentTools, setRecentTools] = useState<RecentTool[]>(() => readRecentTools());
  const [alertCount, setAlertCount] = useState(0);
  const [paperPositionCount, setPaperPositionCount] = useState(0);

  const loadSnapshot = useCallback(async () => {
    const [portfolioRes, watchlistRes, backtestRes, chainRes, benchmarkRes] = await Promise.allSettled([
      fetchPortfolio(),
      fetchWatchlist(),
      fetchBacktestV1Presets(),
      fetchChainSummary("SPY"),
      fetchPortfolioBenchmarkOverlay(),
    ]);

    let next = { ...EMPTY_SNAPSHOT };
    let nextBenchmarkPoints: number[] = [];
    let nextPerformanceLabels: string[] = [];

    if (portfolioRes.status === "fulfilled") {
      const data = portfolioRes.value;
      setPortfolioItems(data.items || []);
      const derivedValue = data.summary.total_value ?? data.items.reduce((acc, row) => acc + Number(row.current_value ?? 0), 0);
      next.equityValue = Number.isFinite(derivedValue) ? derivedValue : null;
      next.equityCost = Number(data.summary.total_cost ?? 0);
      next.equityPnl =
        typeof data.summary.overall_pnl === "number"
          ? data.summary.overall_pnl
          : next.equityValue != null
            ? next.equityValue - next.equityCost
            : null;
      next.holdingsCount = data.items.length;
    }

    if (watchlistRes.status === "fulfilled") {
      const items = watchlistRes.value;
      next.watchlistCount = items.length;
      next.watchlistDerivativesCount = items.filter((row) => row.has_futures || row.has_options).length;
    }

    if (backtestRes.status === "fulfilled") {
      next.backtestPresetCount = backtestRes.value.length;
    }

    if (chainRes.status === "fulfilled") {
      next.fnoSpot = Number.isFinite(chainRes.value.spot_price) ? chainRes.value.spot_price : null;
      next.fnoPcr = Number.isFinite(chainRes.value.pcr?.pcr_oi) ? chainRes.value.pcr.pcr_oi : null;
      next.fnoSignal = String(chainRes.value.pcr?.signal || "NA").toUpperCase();
    }

    if (benchmarkRes.status === "fulfilled" && benchmarkRes.value?.equity_curve?.length > 0) {
      const curve = benchmarkRes.value.equity_curve;
      const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentCurve = curve.filter((pt) => {
        const ms = Date.parse(`${pt.date}T00:00:00Z`);
        return Number.isFinite(ms) && ms >= cutoffMs;
      });
      const windowCurve = (recentCurve.length >= 2 ? recentCurve : curve.slice(-30)).filter((pt) =>
        Number.isFinite(Number(pt.portfolio)) && Number(pt.portfolio) > 0,
      );

      const currentPortfolioValue =
        next.equityValue != null && Number.isFinite(next.equityValue)
          ? next.equityValue
          : null;
      const lastPortfolio = Number(windowCurve[windowCurve.length - 1]?.portfolio ?? NaN);
      const lastBenchmark = Number(windowCurve[windowCurve.length - 1]?.benchmark ?? NaN);
      const canScalePortfolio = currentPortfolioValue != null && Number.isFinite(lastPortfolio) && lastPortfolio > 0;
      const canScaleBenchmark = currentPortfolioValue != null && Number.isFinite(lastBenchmark) && lastBenchmark > 0;

      const scaledPoints = windowCurve
        .map((pt) => {
          const portfolio = Number(pt.portfolio);
          if (!Number.isFinite(portfolio)) return 0;
          return canScalePortfolio ? (portfolio / lastPortfolio) * currentPortfolioValue! : portfolio;
        })
        .filter((value) => Number.isFinite(value) && value > 0);

      const scaledBenchmarkPoints = windowCurve
        .map((pt) => {
          const benchmark = Number(pt.benchmark);
          if (!Number.isFinite(benchmark)) return 0;
          return canScaleBenchmark ? (benchmark / lastBenchmark) * currentPortfolioValue! : benchmark;
        })
        .filter((value) => Number.isFinite(value) && value > 0);

      if (scaledPoints.length >= 2) {
        setPerformancePoints(scaledPoints);
        nextPerformanceLabels = windowCurve.map((pt) => formatCompactDateLabel(pt.date));
      }

      if (scaledBenchmarkPoints.length >= 2) {
        nextBenchmarkPoints = scaledBenchmarkPoints;
      }
    }

    setPerformanceBenchmarkPoints(nextBenchmarkPoints);
    setPerformanceLabels(nextPerformanceLabels);
    next.updatedAt = Date.now();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let active = true;
    setResultsLoading(true);
    fetchDashboardResults(4)
      .then((data) => {
        if (active) setDashboardResults(data);
      })
      .catch(() => {
        if (active) setDashboardResults({ modelLab: [], portfolioLab: [] });
      })
      .finally(() => {
        if (active) setResultsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    let active = true;

    const loadMarketPulse = async () => {
      try {
        const payload = await fetchQuotesBatch(MARKET_PULSE_SYMBOLS, selectedMarket);
        if (!active) return;
        const quotesBySymbol = new Map(
          (payload?.quotes || []).map((quote) => [String(quote.symbol || "").toUpperCase(), quote]),
        );
        setMarketRows((prev) =>
          prev.map((row) => {
            const quote = quotesBySymbol.get(row.symbol.toUpperCase());
            if (!quote || !Number.isFinite(Number(quote.last))) {
              return row.flash ? { ...row, flash: null } : row;
            }
            const nextLtp = Number(quote.last);
            const nextChg = Number.isFinite(Number(quote.change)) ? Number(quote.change) : row.chg;
            const nextChgPct = Number.isFinite(Number(quote.changePct)) ? Number(quote.changePct) : row.chgPct;
            const flash: MarketRow["flash"] = nextLtp > row.ltp ? "up" : nextLtp < row.ltp ? "down" : null;
            return {
              ...row,
              ltp: nextLtp,
              chg: nextChg,
              chgPct: nextChgPct,
              flash,
            };
          }),
        );
      } catch {
        if (!active) return;
      }
    };

    void loadMarketPulse();
    const timer = window.setInterval(() => {
      void loadMarketPulse();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedMarket]);

  useEffect(() => {
    let active = true;

    const loadNews = async () => {
      try {
        const items = await fetchLatestNews(NEWS_LIMIT);
        if (active && items.length) {
          setNewsLog(items);
        }
      } catch {
        if (!active) return;
      }
    };

    void loadNews();
    if (newsAutoRefresh) {
      const timer = window.setInterval(() => {
        void loadNews();
      }, newsRefreshSec * 1000);
      return () => {
        active = false;
        window.clearInterval(timer);
      };
    }

    return () => {
      active = false;
    };
  }, [newsAutoRefresh, newsRefreshSec]);

  useEffect(() => {
    let active = true;
    const loadActionSignals = async () => {
      const [alertsRes, paperRes] = await Promise.allSettled([fetchAlerts(), fetchPaperPortfolios()]);
      if (!active) return;
      if (alertsRes.status === "fulfilled") {
        setAlertCount(alertsRes.value.filter((row) => String(row.status || "").toLowerCase() !== "disabled").length);
      }
      if (paperRes.status === "fulfilled" && paperRes.value.length > 0) {
        const portfolioId = String(paperRes.value[0]?.id || "");
        if (portfolioId) {
          try {
            const positions = await fetchPaperPositions(portfolioId);
            if (active) setPaperPositionCount(positions.length);
          } catch {
            if (active) setPaperPositionCount(0);
          }
        }
      }
    };
    void loadActionSignals();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initializing) return;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(TRANSITION_FLAG_KEY);
      setInitializing(false);
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [initializing]);

  useEffect(() => {
    if (marketRows.some((row) => row.symbol === selectedHeatId)) return;
    setSelectedHeatId(marketRows[0]?.symbol ?? null);
  }, [marketRows, selectedHeatId]);

  const equityPnlPct = useMemo(() => {
    if (snapshot.equityPnl == null || snapshot.equityCost <= 0) return null;
    return (snapshot.equityPnl / snapshot.equityCost) * 100;
  }, [snapshot.equityCost, snapshot.equityPnl]);

  const performanceSeries = useMemo(
    () =>
      performancePoints.map((value, index) => ({
        label: performanceLabels[index] ?? `D${index + 1}`,
        value,
      })),
    [performanceLabels, performancePoints],
  );

  const benchmarkSeries = useMemo(
    () =>
      performanceBenchmarkPoints.map((value, index) => ({
        label: performanceLabels[index] ?? `D${index + 1}`,
        value,
      })),
    [performanceBenchmarkPoints, performanceLabels],
  );

  const heatItems = useMemo<MarketHeatStripItem[]>(
    () =>
      marketRows.map((row) => ({
        id: row.symbol,
        label: row.label || row.symbol,
        value: row.ltp > 0 ? row.ltp : null,
        changePct: row.ltp > 0 ? row.chgPct : null,
        changeLabel:
          row.ltp > 0
            ? `${row.chg >= 0 ? "+" : ""}${formatPrice(row.chg)} / ${formatPercent(row.chgPct)}`
            : "--",
        flash: row.flash,
      })),
    [marketRows],
  );

  const focusedMarket = useMemo(
    () => marketRows.find((row) => row.symbol === selectedHeatId) ?? marketRows[0] ?? null,
    [marketRows, selectedHeatId],
  );

  useEffect(() => {
    const syncFromStorage = () => setActivePreset(readWorkspacePreset());
    const onPresetChange = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (detail === "trader" || detail === "quant" || detail === "pm" || detail === "risk" || detail === "ops") {
        setActivePreset(detail);
        return;
      }
      syncFromStorage();
    };
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("ot:preset-change", onPresetChange as EventListener);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("ot:preset-change", onPresetChange as EventListener);
    };
  }, []);

  const presetConfig = getWorkspacePresetConfig(activePreset);
  const showHomeSection = useCallback((section: string) => presetConfig.homeSections.includes(section), [presetConfig.homeSections]);

  const openTool = useCallback(
    (to: string, label?: string) => {
      setRecentTools(recordRecentTool(to, label));
      setExploreOpen(false);
      navigate(to);
    },
    [navigate],
  );

  const launchSections = useMemo<QuickNavSection[]>(
    () => {
      const preferred = new Set(presetConfig.quickLinks.map((link) => link.to));
      return NAV_CARD_SECTIONS.map((section) => ({
        id: slugifyNav(section.title),
        title: section.title,
        // Show ALL nav cards — the workspace preset only reorders (preferred first),
        // it must never hide features from the launcher.
        items: section.cards
          .slice()
          .sort((a, b) => Number(preferred.has(b.to)) - Number(preferred.has(a.to)))
          .map((card) => ({
          id: `${slugifyNav(section.title)}-${slugifyNav(card.label)}`,
          label: card.label,
          shortcut: card.badge,
          description: `${section.title} desk access`,
          onSelect: () => openTool(card.to, card.label),
        })),
      })).filter((section) => section.items.length > 0);
    },
    [openTool, presetConfig.quickLinks],
  );

  const marketQuotesReady = marketRows.some((row) => row.ltp > 0);
  const snapshotAgeMs = snapshot.updatedAt == null ? null : Date.now() - snapshot.updatedAt;
  const providerIssues = snapshot.fnoSignal === "NA" && !marketQuotesReady;
  const actionQueueItems = useMemo(
    () =>
      buildActionQueue({
        alertCount,
        marketQuotesReady,
        snapshotAgeMs,
        newsCount: newsLog.length,
        backtestPresetCount: snapshot.backtestPresetCount,
        paperPositionCount,
        holdingsCount: snapshot.holdingsCount,
        providerIssues,
      }),
    [
      alertCount,
      marketQuotesReady,
      newsLog.length,
      paperPositionCount,
      providerIssues,
      snapshot.backtestPresetCount,
      snapshot.holdingsCount,
      snapshotAgeMs,
    ],
  );

  const updatedLabel = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString("en-US", { hour12: false })
    : "--:--:--";

  const profileMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!user?.email) missing.push("Email");
    if (!user?.role) missing.push("Role");
    if (snapshot.updatedAt == null) missing.push("Snapshot");
    if (newsLog.length === 0) missing.push("News");
    return missing;
  }, [newsLog.length, snapshot.updatedAt, user?.email, user?.role]);

  const profileCompletion = Math.round(((4 - profileMissingFields.length) / 4) * 100);

  const systemHealthItems = useMemo<SystemHealthItem[]>(
    () => [
      {
        id: "auth",
        label: "AUTH",
        value: user ? `${user.role.toUpperCase()} READY` : "GUEST",
        tone: user ? "ok" : "warning",
      },
      {
        id: "relay",
        label: "RELAY",
        value: `${selectedMarket} ${realtimeMode.toUpperCase()}`,
        tone: realtimeMode === "ws" ? "ok" : "info",
      },
      {
        id: "snapshot",
        label: "SNAPSHOT",
        value: updatedLabel,
        tone: snapshot.updatedAt ? "stale" : "offline",
      },
      {
        id: "news",
        label: "NEWS",
        value: newsAutoRefresh ? `AUTO ${newsRefreshSec}s` : "MANUAL",
        tone: newsAutoRefresh ? "info" : "neutral",
      },
      {
        id: "fno",
        label: "Options & Futures",
        value: `${snapshot.fnoSignal}${snapshot.fnoPcr != null ? ` | ${snapshot.fnoPcr.toFixed(2)}` : ""}`,
        tone: getSystemTone(snapshot.fnoSignal),
      },
    ],
    [newsAutoRefresh, newsRefreshSec, realtimeMode, selectedMarket, snapshot.fnoPcr, snapshot.fnoSignal, snapshot.updatedAt, updatedLabel, user],
  );

  const leadHeadline = newsLog[0] ?? null;

  return (
    <TerminalShell
      contentClassName="bg-terminal-bg pb-20 md:pb-0"
      hideTickerLoader
      showMobileBottomNav
      showWorkspaceControls
      statusBarTickerOverride="MISSION CONTROL"
    >
      <div className="relative min-h-full bg-terminal-bg">
        {initializing ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-terminal-bg/95" role="status" aria-live="polite">
            <p className="ot-type-panel-title uppercase tracking-[0.18em] text-terminal-accent">Initializing Mission Control</p>
            <div className="h-1.5 w-64 overflow-hidden rounded-full border border-terminal-border bg-terminal-panel/80">
              <span className="block h-full w-2/3 animate-pulse bg-terminal-accent/80" />
            </div>
          </div>
        ) : null}

        {!initializing ? (
          <main className="flex min-h-full flex-col gap-3 p-3 md:p-4" aria-label="Mission Control Dashboard">
            {/* ── Desktop header (≥768px) ── */}
            <section className="hidden md:block rounded-sm border border-terminal-border bg-terminal-panel/80 p-3" aria-label="Home Header">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="ot-type-panel-title uppercase tracking-[0.18em] text-terminal-accent">Mission Control</p>
                    <span
                      className="rounded-sm border border-terminal-accent/60 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-terminal-accent"
                      data-testid="active-workspace-badge"
                    >
                      {presetConfig.label} workspace
                    </span>
                  </div>
                  <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-terminal-text">{presetConfig.landing.headline}</h1>
                  <p className="max-w-3xl text-sm text-terminal-muted">
                    {presetConfig.landing.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">
                    <span className="rounded-sm border border-terminal-border px-2 py-1">
                      Desk {(user?.email || "unknown").toUpperCase()}
                    </span>
                    <span className="rounded-sm border border-terminal-border px-2 py-1">
                      Market {selectedMarket}
                    </span>
                    <span className="rounded-sm border border-terminal-border px-2 py-1">
                      Currency {displayCurrency}
                    </span>
                    <span className="rounded-sm border border-terminal-border px-2 py-1">
                      Refresh {newsAutoRefresh ? `${newsRefreshSec}s` : "Manual"}
                    </span>
                  </div>
                  <div className="pt-1" data-testid="home-pinned-tools">
                    <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">Pinned tools</p>
                    <div className="flex flex-wrap gap-1.5">
                      {presetConfig.quickLinks.map((link) => (
                        <button
                          key={link.to}
                          type="button"
                          className="rounded-sm border border-terminal-border px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-terminal-text hover:border-terminal-accent hover:text-terminal-accent"
                          onClick={() => openTool(link.to, link.label)}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <LiveClockStrip />
                  <div className="flex flex-wrap gap-2" data-testid="home-primary-actions">
                    <button
                      type="button"
                      className="rounded-sm border border-terminal-accent px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-accent hover:bg-terminal-accent/10"
                      onClick={() => openTool(presetConfig.landing.primaryRoute, presetConfig.landing.primaryLabel)}
                      data-testid="home-primary-action"
                    >
                      {presetConfig.landing.primaryLabel}
                    </button>
                    <button
                      type="button"
                      className="rounded-sm border border-terminal-border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                      onClick={() => setExploreOpen(true)}
                      data-testid="explore-all-tools-open"
                    >
                      Explore all tools
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <MarketHeatStrip
                  ariaLabel="Market heat strip"
                  items={heatItems}
                  selectedItemId={selectedHeatId}
                  formatValue={(value) => (typeof value === "number" ? formatPrice(value) : "--")}
                  onSelect={(item) => setSelectedHeatId(item.id)}
                />
              </div>
            </section>

            {/* ── Mobile header (<768px) ── */}
            <section className="block md:hidden rounded-sm border border-terminal-border bg-terminal-panel/80 p-2.5" aria-label="Mobile Home Header">
              {/* Top row: short title + desk toggle */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-terminal-accent leading-tight">Mission Control</p>
                  <h1 className="text-sm font-semibold uppercase tracking-normal text-terminal-text truncate">
                    {presetConfig.landing.headline}
                  </h1>
                  <p className="mt-0.5 text-[11px] text-terminal-accent" data-testid="active-workspace-badge-mobile">
                    {presetConfig.label} workspace
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeskSettings((v) => !v)}
                  className="shrink-0 rounded-sm border border-terminal-border px-2 py-1 text-[10px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                  aria-expanded={showDeskSettings}
                  aria-label="Desk settings"
                >
                  {showDeskSettings ? "▲ Desk" : "▼ Desk"}
                </button>
              </div>

              {/* Status row: market / connection / primary action */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-terminal-muted truncate">
                  {selectedMarket} · {realtimeMode === "ws" ? "LIVE" : "POLL"} · {updatedLabel}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-sm border border-terminal-accent px-2 py-1 text-[10px] uppercase tracking-wider text-terminal-accent hover:bg-terminal-accent/10"
                  onClick={() => openTool(presetConfig.landing.primaryRoute, presetConfig.landing.primaryLabel)}
                  data-testid="home-primary-action-mobile"
                >
                  {presetConfig.landing.primaryLabel}
                </button>
              </div>

              <div className="mt-2" data-testid="home-pinned-tools-mobile">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-terminal-muted">Pinned tools</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {presetConfig.quickLinks.slice(0, 4).map((link) => (
                    <button
                      key={link.to}
                      type="button"
                      className="shrink-0 rounded-sm border border-terminal-border px-2 py-1 text-[10px] uppercase tracking-wider text-terminal-text"
                      onClick={() => openTool(link.to, link.label)}
                    >
                      {link.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="shrink-0 rounded-sm border border-terminal-accent/60 px-2 py-1 text-[10px] uppercase tracking-wider text-terminal-accent"
                    onClick={() => setExploreOpen(true)}
                    data-testid="explore-all-tools-open-mobile"
                  >
                    Explore
                  </button>
                </div>
              </div>

              {/* Expandable desk settings panel */}
              {showDeskSettings ? (
                <div className="mt-2 border-t border-terminal-border pt-3 space-y-3">
                  {/* Clocks — horizontal swipe rail */}
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-terminal-muted">Clocks</p>
                    <LiveClockStrip />
                  </div>

                  {/* Identity & config — two-column grid with 44px min-height touch targets */}
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-terminal-muted">Desk Config</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex min-h-[44px] items-center rounded-sm border border-terminal-border px-2.5 text-[10px] uppercase tracking-wider text-terminal-muted truncate">
                        {(user?.email || "unknown").toUpperCase()}
                      </div>
                      <div className="flex min-h-[44px] items-center rounded-sm border border-terminal-border px-2.5 text-[10px] uppercase tracking-wider text-terminal-muted">
                        {selectedMarket}
                      </div>
                      <div className="flex min-h-[44px] items-center rounded-sm border border-terminal-accent/60 px-2.5 text-[10px] uppercase tracking-wider text-terminal-accent truncate">
                        {presetConfig.label}
                      </div>
                      <div className="flex min-h-[44px] items-center rounded-sm border border-terminal-border px-2.5 text-[10px] uppercase tracking-wider text-terminal-muted">
                        {displayCurrency}
                      </div>
                      <div className="flex min-h-[44px] items-center rounded-sm border border-terminal-border px-2.5 text-[10px] uppercase tracking-wider text-terminal-muted col-span-2">
                        Refresh {newsAutoRefresh ? `${newsRefreshSec}s auto` : "Manual"}
                      </div>
                    </div>
                  </div>

                  {/* Primary shortcuts */}
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-terminal-muted">Shortcuts</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="flex min-h-[44px] items-center justify-center rounded-sm border border-terminal-accent px-3 text-[11px] uppercase tracking-wider text-terminal-accent hover:bg-terminal-accent/10"
                        onClick={() => navigate("/equity/chart-workstation")}
                      >
                        Open Workstation
                      </button>
                      <button
                        type="button"
                        className="flex min-h-[44px] items-center justify-center rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => navigate("/equity/portfolio")}
                      >
                        Portfolio HQ
                      </button>
                      <button
                        type="button"
                        className="flex min-h-[44px] items-center justify-center rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => navigate("/equity/launchpad")}
                      >
                        Launchpad
                      </button>
                      <button
                        type="button"
                        className="flex min-h-[44px] items-center justify-center rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => navigate("/equity/news")}
                      >
                        Intel Wire
                      </button>
                    </div>
                  </div>

                  {/* Secondary / reset actions */}
                  <details className="group">
                    <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm border border-terminal-border px-2.5 text-[10px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent list-none">
                      <span className="transition-transform group-open:rotate-90">▶</span>
                      Advanced
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="flex min-h-[40px] items-center justify-center rounded-sm border border-terminal-border px-3 text-[10px] uppercase tracking-wider text-terminal-muted hover:border-rose-500 hover:text-rose-400"
                        onClick={() => {
                          if (typeof window !== "undefined" && window.confirm("Reset all trader settings?")) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }}
                      >
                        Reset Trader
                      </button>
                      <button
                        type="button"
                        className="flex min-h-[40px] items-center justify-center rounded-sm border border-terminal-border px-3 text-[10px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => navigate("/equity/settings")}
                      >
                        All Settings
                      </button>
                    </div>
                  </details>
                </div>
              ) : null}

              {/* MarketHeatStrip — always visible on mobile */}
              <div className="mt-2">
                <MarketHeatStrip
                  ariaLabel="Market heat strip"
                  items={heatItems}
                  selectedItemId={selectedHeatId}
                  formatValue={(value) => (typeof value === "number" ? formatPrice(value) : "--")}
                  onSelect={(item) => setSelectedHeatId(item.id)}
                />
              </div>
            </section>

            <section
              className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
              aria-label="Market now"
              data-testid="market-now"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">
                    Market now
                  </h2>
                  <p className="mt-1 text-sm text-terminal-muted">
                    Indexes, session status, and the top headlines for this desk.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em]">
                  <span className="rounded-sm border border-terminal-border px-2 py-1 text-terminal-muted">
                    {selectedMarket} · {realtimeMode === "ws" ? "LIVE" : "POLL"}
                  </span>
                  <span
                    className={`rounded-sm border px-2 py-1 ${
                      marketQuotesReady ? "border-terminal-accent/50 text-terminal-accent" : "border-amber-500/50 text-amber-200"
                    }`}
                  >
                    {marketQuotesReady ? "Quotes ready" : "Quotes pending"}
                  </span>
                  <span className="rounded-sm border border-terminal-border px-2 py-1 text-terminal-muted">
                    Synced {updatedLabel}
                  </span>
                </div>
              </div>
              {newsLog.length > 0 ? (
                <ul className="space-y-2" role="list" aria-label="Key headlines">
                  {newsLog.slice(0, 3).map((entry) => (
                    <li key={String(entry.id)} className="rounded-sm border border-terminal-border bg-terminal-bg/40 px-2.5 py-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-terminal-muted">{entry.source}</p>
                      <p className="mt-0.5 text-sm text-terminal-text">{entry.title}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <GuidedEmptyState
                  title="No session headlines yet"
                  message="Open the news desk or wait for the next poll so Market now has context."
                  icon="NEWS"
                  actions={[{ label: "Open News", onClick: () => openTool("/equity/news", "News") }]}
                />
              )}
            </section>

            <section
              className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
              aria-label="Your desk"
              data-testid="your-desk"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">
                    Your desk
                  </h2>
                  <p className="mt-1 text-sm text-terminal-muted">
                    Active workspace, pinned tools, and recently opened screens.
                  </p>
                </div>
                <span className="rounded-sm border border-terminal-accent/60 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-terminal-accent">
                  {presetConfig.label} workspace
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="your-desk-pinned">
                {presetConfig.quickLinks.map((link) => (
                  <button
                    key={`desk-${link.to}`}
                    type="button"
                    className="min-h-11 rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-[0.1em] text-terminal-text hover:border-terminal-accent hover:text-terminal-accent"
                    onClick={() => openTool(link.to, link.label)}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-terminal-border pt-3">
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">Recent screens</p>
                {recentTools.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="your-desk-recent">
                    {recentTools.map((tool) => (
                      <button
                        key={`${tool.to}-${tool.at}`}
                        type="button"
                        className="min-h-11 rounded-sm border border-terminal-border/80 bg-terminal-bg/40 px-3 text-[11px] uppercase tracking-[0.1em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => openTool(tool.to, tool.label)}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <GuidedEmptyState
                    title="No recent screens yet"
                    message="Open a pinned tool or explore the full launcher. Recent screens will appear here."
                    icon="RECENT"
                    actions={[{ label: "Explore all tools", onClick: () => setExploreOpen(true) }]}
                  />
                )}
              </div>
            </section>

            <ActionQueueSection
              items={actionQueueItems}
              onSelect={(item) => openTool(item.to, item.actionLabel)}
              onExplore={() => setExploreOpen(true)}
            />

            <section
              className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
              aria-label="Portfolio snapshot"
              data-testid="portfolio-snapshot"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">
                    Portfolio snapshot
                  </h2>
                  <p className="mt-1 text-sm text-terminal-muted">
                    Value, daily P/L, exposure, and risk posture for the active book.
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                  onClick={() => openTool("/equity/portfolio", "Holdings")}
                >
                  Open Portfolio
                </button>
              </div>
              {snapshot.holdingsCount > 0 || snapshot.equityValue != null ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Net Liquidation"
                    value={formatUsd(snapshot.equityValue)}
                    tone={getMetricTone(snapshot.equityPnl)}
                    delta={
                      snapshot.equityPnl == null
                        ? undefined
                        : {
                            label: `${formatSignedUsd(snapshot.equityPnl)} (${formatPercent(equityPnlPct)})`,
                            tone: getMetricTone(snapshot.equityPnl),
                          }
                    }
                  />
                  <MetricCard
                    label="Holdings"
                    value={String(snapshot.holdingsCount)}
                    tone={snapshot.holdingsCount > 0 ? "accent" : "neutral"}
                    details={[
                      { label: "Watchlist", value: String(snapshot.watchlistCount) },
                      { label: "Derivatives linked", value: String(snapshot.watchlistDerivativesCount) },
                    ]}
                  />
                  <MetricCard
                    label="Exposure signal"
                    value={snapshot.fnoSignal}
                    tone={getSignalTone(snapshot.fnoSignal)}
                    details={[
                      {
                        label: "PCR",
                        value: snapshot.fnoPcr != null ? snapshot.fnoPcr.toFixed(2) : "--",
                      },
                    ]}
                  />
                  <MetricCard
                    label="Risk warning"
                    value={
                      snapshot.equityPnl != null && snapshot.equityPnl < 0
                        ? "Drawdown active"
                        : snapshot.holdingsCount === 0
                          ? "No book loaded"
                          : "Within band"
                    }
                    tone={
                      snapshot.equityPnl != null && snapshot.equityPnl < 0
                        ? "down"
                        : snapshot.holdingsCount === 0
                          ? "neutral"
                          : "up"
                    }
                    details={[{ label: "Risk desk", value: "Open for limits", tone: "accent" }]}
                    footer={
                      <button
                        type="button"
                        className="rounded-sm border border-terminal-border px-2 py-1.5 text-[11px] uppercase tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                        onClick={() => openTool("/equity/risk", "Risk Desk")}
                      >
                        Open Risk
                      </button>
                    }
                  />
                </div>
              ) : (
                <GuidedEmptyState
                  title="Portfolio is empty"
                  message="Import or add holdings so Mission Control can show value, P/L, and exposure."
                  icon="PORTFOLIO"
                  actions={[{ label: "Open Portfolio", onClick: () => openTool("/equity/portfolio", "Holdings") }]}
                />
              )}
            </section>

            <section
              className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
              aria-label="Explore all tools"
              data-testid="explore-all-tools"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">
                    Explore all tools
                  </h2>
                  <p className="mt-1 text-sm text-terminal-muted">
                    Open the full categorized launcher. Every advanced route stays two taps away from Home.
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-sm border border-terminal-accent px-4 text-[11px] uppercase tracking-[0.12em] text-terminal-accent hover:bg-terminal-accent/10"
                  onClick={() => setExploreOpen(true)}
                  data-testid="explore-all-tools-cta"
                >
                  Browse full launcher
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1">
              <AiInsightCard
                title="AI Market Outlook"
                description="Gemma-synthesized assessment of global market themes and regime"
                fetcher={() => fetchCollectionBriefing(MARKET_PULSE_SYMBOLS, "global markets")}
              />
            </div>

            {showHomeSection("portfolio") || showHomeSection("health") || showHomeSection("news") ? (
            <section className="grid gap-3 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]" aria-label="Portfolio HQ">
              {showHomeSection("portfolio") ? (
              <div className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3">
                <div className="flex flex-col gap-3 border-b border-terminal-border pb-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">Portfolio HQ</h2>
                    <p className="mt-1 text-sm text-terminal-muted">
                      Equity valuation, derivatives posture, and performance telemetry anchored to the current home snapshot.
                    </p>
                  </div>
                  <ProfileCompletionRing
                    value={profileCompletion}
                    missingFields={profileMissingFields}
                    className="shrink-0"
                  />
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <MetricCard
                    label="Net Liquidation"
                    value={formatUsd(snapshot.equityValue)}
                    tone={getMetricTone(snapshot.equityPnl)}
                    delta={
                      snapshot.equityPnl == null
                        ? undefined
                        : {
                            label: `${formatSignedUsd(snapshot.equityPnl)} (${formatPercent(equityPnlPct)})`,
                            tone: getMetricTone(snapshot.equityPnl),
                          }
                    }
                    details={[
                      { label: "Holdings", value: String(snapshot.holdingsCount) },
                      { label: "Watchlist", value: String(snapshot.watchlistCount), tone: "accent" },
                      { label: "Backtests", value: String(snapshot.backtestPresetCount) },
                      { label: "Sync", value: updatedLabel, tone: "neutral" },
                    ]}
                    sparklinePoints={performancePoints}
                    sparklineAriaLabel="Net liquidation trend"
                    footer={
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-sm border border-terminal-border px-2 py-1.5 text-[11px] uppercase ot-home-badge-mobile tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                          onClick={() => navigate("/equity/portfolio")}
                        >
                          Open Portfolio
                        </button>
                        <button
                          type="button"
                          className="rounded-sm border border-terminal-border px-2 py-1.5 text-[11px] uppercase ot-home-badge-mobile tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                          onClick={() => navigate("/backtesting")}
                        >
                          Run Backtests
                        </button>
                      </div>
                    }
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      label="Market Focus"
                      value={focusedMarket?.ltp && focusedMarket.ltp > 0 ? formatPrice(focusedMarket.ltp) : "--"}
                      tone={getMetricTone(focusedMarket?.chg ?? null)}
                      delta={
                        focusedMarket
                          ? {
                              label:
                                focusedMarket.ltp > 0
                                  ? `${focusedMarket.chg >= 0 ? "+" : ""}${formatPrice(focusedMarket.chg)} (${formatPercent(focusedMarket.chgPct)})`
                                  : "--",
                              tone: getMetricTone(focusedMarket.chg),
                            }
                          : undefined
                      }
                      details={[
                        { label: "Ticker", value: focusedMarket?.label || "--" },
                        { label: "Desk", value: selectedMarket, tone: "accent" },
                      ]}
                    />

                    <MetricCard
                      label="Options & Futures Regime"
                      value={snapshot.fnoSignal}
                      tone={getSignalTone(snapshot.fnoSignal)}
                      details={[
                        {
                          label: "PCR",
                          value: snapshot.fnoPcr != null ? snapshot.fnoPcr.toFixed(2) : "--",
                          tone: getSignalTone(snapshot.fnoSignal),
                        },
                        {
                          label: "Spot",
                          value: snapshot.fnoSpot != null ? formatPrice(snapshot.fnoSpot) : "--",
                        },
                      ]}
                    />

                    <MetricCard
                      label="Watchlist Radar"
                      value={`${snapshot.watchlistCount} Symbols`}
                      tone={snapshot.watchlistCount > 0 ? "accent" : "neutral"}
                      delta={{
                        label: `${snapshot.watchlistDerivativesCount} Options & Futures linked`,
                        tone: snapshot.watchlistDerivativesCount > 0 ? "up" : "neutral",
                      }}
                      details={[
                        { label: "Derivatives", value: String(snapshot.watchlistDerivativesCount) },
                        { label: "Relay", value: realtimeMode.toUpperCase() },
                      ]}
                    />

                    <MetricCard
                      label="Research Queue"
                      value={`${newsLog.length} Headlines`}
                      tone={leadHeadline?.sentiment?.label === "Bearish" ? "down" : leadHeadline ? "accent" : "neutral"}
                      delta={{
                        label: newsAutoRefresh ? `Auto refresh ${newsRefreshSec}s` : "Manual news sync",
                        tone: newsAutoRefresh ? "accent" : "neutral",
                      }}
                      details={[
                        { label: "Lead Source", value: leadHeadline?.source || "--" },
                        { label: "Headlines", value: String(newsLog.length) },
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-sm border border-terminal-border bg-terminal-bg/40 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">30D Performance</h3>
                      <p className="mt-1 text-xs text-terminal-muted">
                        Portfolio trajectory normalized against the benchmark overlay from the portfolio analytics feed.
                      </p>
                    </div>
                    <span className="rounded-sm border border-terminal-border px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">
                      Synced {updatedLabel}
                    </span>
                  </div>
                  <PortfolioMiniChart
                    points={performanceSeries}
                    benchmarkPoints={benchmarkSeries}
                    ariaLabel="Portfolio HQ chart"
                    valueFormatter={(value) => formatUsd(value)}
                  />
                </div>
              </div>
              ) : null}

              {showHomeSection("health") || showHomeSection("news") ? (
              <div className="space-y-3">
                {showHomeSection("health") ? (
                <section className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3" aria-label="System Health">
                  <div className="mb-3">
                    <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">System Health</h2>
                    <p className="mt-1 text-sm text-terminal-muted">
                      Auth, relay mode, news cadence, and derivatives signal surfaced as a single mission-control rail.
                    </p>
                  </div>
                  <SystemHealthBar ariaLabel="System health indicators" items={systemHealthItems} />
                  <div className="mt-3 grid gap-2 text-xs text-terminal-muted sm:grid-cols-2">
                    <div className="rounded-sm border border-terminal-border bg-terminal-bg/40 px-2 py-2">
                      <span className="block text-[11px] uppercase tracking-[0.12em]">Focus Asset</span>
                      <span className="mt-1 block text-sm text-terminal-text">{focusedMarket?.label || "--"}</span>
                    </div>
                    <div className="rounded-sm border border-terminal-border bg-terminal-bg/40 px-2 py-2">
                      <span className="block text-[11px] uppercase tracking-[0.12em]">Desk Mode</span>
                      <span className="mt-1 block text-sm text-terminal-text">
                        {selectedMarket} / {displayCurrency}
                      </span>
                    </div>
                  </div>
                </section>
                ) : null}

                {showHomeSection("news") ? (
                <section className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3" aria-label="Intel Wire">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">Intel Wire</h2>
                      <p className="mt-1 text-sm text-terminal-muted">
                        Latest headlines from the existing news polling loop with sentiment carried through from the API payload.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-sm border border-terminal-border px-2 py-1.5 text-[11px] uppercase ot-home-badge-mobile tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                      onClick={() => navigate("/equity/news")}
                    >
                      Open News
                    </button>
                  </div>

                  {newsLog.length > 0 ? (
                    <ol className="space-y-2" role="list" aria-label="Latest headlines">
                      {newsLog.slice(0, 5).map((entry) => (
                        <li key={String(entry.id)} className="rounded-sm border border-terminal-border bg-terminal-bg/40 p-2">
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block focus-visible:outline-none focus-visible:text-terminal-accent hover:text-terminal-accent"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.12em] text-terminal-muted">
                                  {entry.source}
                                  {entry.published_at
                                    ? ` • ${new Date(entry.published_at).toLocaleTimeString("en-US", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false,
                                      })}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-sm font-medium text-terminal-text">{entry.title}</p>
                              </div>
                              {entry.sentiment ? (
                                <span className={`shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] ${getSentimentClass(entry.sentiment.label)}`}>
                                  {entry.sentiment.label} {Math.round(entry.sentiment.confidence * 100)}%
                                </span>
                              ) : null}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <GuidedEmptyState
                      title="Start the news radar"
                      message="Create a watchlist or open the news desk so the home wire has symbols and headlines to prioritize."
                      icon="NEWS"
                      actions={[
                        { label: "Create Watchlist", onClick: () => navigate("/equity/watchlist") },
                        { label: "Open News", onClick: () => navigate("/equity/news") },
                      ]}
                    />
                  )}
                </section>
                ) : null}
              </div>
              ) : null}
            </section>
            ) : null}

            {showHomeSection("results") || showHomeSection("heatmap") || showHomeSection("timeline") ? (
            <section className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" aria-label="Dashboard Intelligence">
              <div className="space-y-3">
                {showHomeSection("results") ? <ResultsSummaryCards
                  results={dashboardResults}
                  loading={resultsLoading}
                  onRunBacktest={() => navigate("/backtesting")}
                /> : null}
                {showHomeSection("heatmap") ? <ExposureHeatmap
                  title="Portfolio Exposure Heatmap"
                  market={selectedMarket}
                  items={portfolioItems}
                  defaultMode="sector"
                  onCreateWatchlist={() => navigate("/equity/watchlist")}
                  onOpenRisk={() => navigate("/equity/risk")}
                /> : null}
              </div>
              {showHomeSection("timeline") ? <IntelligenceTimeline
                market={selectedMarket}
                symbols={portfolioItems.map((item) => item.ticker)}
                limit={10}
                title="Home Intelligence Timeline"
                onAddAlert={() => openTool("/equity/alerts", "Alerts")}
                onOpenScreener={() => openTool("/equity/screener", "Screener")}
              /> : null}
            </section>
            ) : null}
          </main>
        ) : null}
      </div>
      <ExploreAllToolsDialog open={exploreOpen} onClose={() => setExploreOpen(false)} sections={launchSections} />
    </TerminalShell>
  );
}
