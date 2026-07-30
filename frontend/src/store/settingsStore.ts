import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CountryCode, MarketCode } from "../types/markets";

export type DisplayCurrency = "USD";
export type RealtimeMode = "polling" | "ws";
export type ThemeVariant = "terminal-noir" | "classic-bloomberg" | "light-desk" | "custom";
export type RecentSecurityAssetClass = "equity" | "fno" | "crypto" | "commodity" | "forex" | "etf" | "mf";
export type RecentSecurityMarket = "US";

export type RecentSecurity = {
  symbol: string;
  name: string;
  assetClass: RecentSecurityAssetClass;
  market: RecentSecurityMarket;
  lastPrice?: number;
  changePercent?: number;
  visitedAt: number;
};

const MAX_RECENT_SECURITIES = 20;
const RECENT_SECURITY_ASSET_CLASSES: RecentSecurityAssetClass[] = ["equity", "fno", "crypto", "commodity", "forex", "etf", "mf"];

const US_MARKETS: MarketCode[] = ["NASDAQ", "NYSE"];

const INDIA_RECENT_SYMBOLS = new Set([
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "NIFTY",
  "BANKNIFTY",
  "SENSEX",
  "FINNIFTY",
  "MIDCPNIFTY",
]);

function isIndiaRecentSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".NS") || upper.endsWith(".BO")) return true;
  if (INDIA_RECENT_SYMBOLS.has(upper)) return true;
  if (upper.startsWith("NSE:") || upper.startsWith("BSE:") || upper.startsWith("NFO:")) return true;
  return false;
}

function isRecentSecurityAssetClass(value: unknown): value is RecentSecurityAssetClass {
  return RECENT_SECURITY_ASSET_CLASSES.includes(value as RecentSecurityAssetClass);
}

function sanitizeRecentSecurity(item: unknown): RecentSecurity | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Partial<RecentSecurity> & { market?: string };
  const symbol = String(row.symbol ?? "").trim().toUpperCase();
  if (!symbol) return null;

  // Drop incompatible India symbols — never rewrite them as US.
  const rawMarket = String(row.market ?? "").trim().toUpperCase();
  if (rawMarket === "IN" || rawMarket === "INDIA" || rawMarket === "NSE" || rawMarket === "BSE") {
    return null;
  }
  if (isIndiaRecentSymbol(symbol)) {
    return null;
  }

  const name = String(row.name ?? symbol).trim() || symbol;
  const assetClass = isRecentSecurityAssetClass(row.assetClass) ? row.assetClass : "equity";
  const visitedAt = Number.isFinite(Number(row.visitedAt)) ? Number(row.visitedAt) : Date.now();
  const lastPrice = Number.isFinite(Number(row.lastPrice)) ? Number(row.lastPrice) : undefined;
  const changePercent = Number.isFinite(Number(row.changePercent)) ? Number(row.changePercent) : undefined;

  return {
    symbol,
    name,
    assetClass,
    market: "US",
    lastPrice,
    changePercent,
    visitedAt,
  };
}

function sanitizeRecentSecurities(items: unknown): RecentSecurity[] {
  if (!Array.isArray(items)) return [];

  const deduped = new Map<string, RecentSecurity>();
  for (const item of items) {
    const row = sanitizeRecentSecurity(item);
    if (!row) continue;
    const previous = deduped.get(row.symbol);
    if (!previous || row.visitedAt >= previous.visitedAt) {
      deduped.set(row.symbol, row);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, MAX_RECENT_SECURITIES);
}

type SettingsState = {
  selectedCountry: CountryCode;
  selectedMarket: MarketCode;
  displayCurrency: DisplayCurrency;
  realtimeMode: RealtimeMode;
  newsAutoRefresh: boolean;
  newsRefreshSec: number;
  themeVariant: ThemeVariant;
  customAccentColor: string;
  hudOverlayEnabled: boolean;
  recentSecurities: RecentSecurity[];
  setSelectedCountry: (country: CountryCode) => void;
  setSelectedMarket: (market: MarketCode) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setRealtimeMode: (mode: RealtimeMode) => void;
  setNewsAutoRefresh: (enabled: boolean) => void;
  setNewsRefreshSec: (seconds: number) => void;
  setThemeVariant: (theme: ThemeVariant) => void;
  setCustomAccentColor: (value: string) => void;
  setHudOverlayEnabled: (enabled: boolean) => void;
  addRecentSecurity: (security: RecentSecurity) => void;
  clearRecentSecurities: () => void;
};

const defaultCountry: CountryCode = "US";
const defaultMarket: MarketCode = "NASDAQ";
const defaultCurrency: DisplayCurrency = "USD";

export function normalizePersistedMarket(value: unknown): MarketCode {
  const raw = String(value ?? "").trim().toUpperCase();
  // Legacy India markets → default NASDAQ (settings migration).
  if (raw === "NSE" || raw === "BSE" || raw === "IN") return "NASDAQ";
  // Unsupported-but-formerly-claimed US venues fall back to NASDAQ.
  if (raw === "AMEX" || raw === "CBOE" || raw === "CME") return "NASDAQ";
  if (US_MARKETS.includes(raw as MarketCode)) return raw as MarketCode;
  return defaultMarket;
}

function migratePersistedCurrency(value: unknown): DisplayCurrency {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "INR") return "USD";
  return defaultCurrency;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedCountry: defaultCountry,
      selectedMarket: defaultMarket,
      displayCurrency: defaultCurrency,
      realtimeMode: "polling",
      newsAutoRefresh: true,
      newsRefreshSec: 60,
      themeVariant: "terminal-noir",
      customAccentColor: "#FF6B00",
      hudOverlayEnabled: false,
      recentSecurities: [],
      setSelectedCountry: () => {
        set({
          selectedCountry: defaultCountry,
          selectedMarket: defaultMarket,
          displayCurrency: defaultCurrency,
        });
      },
      setSelectedMarket: (market) => set({ selectedMarket: market }),
      setDisplayCurrency: () => set({ displayCurrency: defaultCurrency }),
      setRealtimeMode: (mode) => set({ realtimeMode: mode }),
      setNewsAutoRefresh: (enabled) => set({ newsAutoRefresh: enabled }),
      setNewsRefreshSec: (seconds) => set({ newsRefreshSec: seconds }),
      setThemeVariant: (theme) => set({ themeVariant: theme }),
      setCustomAccentColor: (value) =>
        set({
          customAccentColor: /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : "#FF6B00",
        }),
      setHudOverlayEnabled: (enabled) => set({ hudOverlayEnabled: enabled }),
      addRecentSecurity: (security) =>
        set((state) => {
          const next = sanitizeRecentSecurity(security);
          if (!next) return {};

          return {
            recentSecurities: [next, ...state.recentSecurities.filter((item) => item.symbol !== next.symbol)].slice(
              0,
              MAX_RECENT_SECURITIES,
            ),
          };
        }),
      clearRecentSecurities: () => set({ recentSecurities: [] }),
    }),
    {
      name: "ui-settings",
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SettingsState>) ?? {};
        const current = currentState as SettingsState;

        const persistedCountry = String((persisted as { selectedCountry?: string }).selectedCountry ?? "").toUpperCase();
        const persistedMarket = String((persisted as { selectedMarket?: string }).selectedMarket ?? "").toUpperCase();
        const persistedCurrency = String((persisted as { displayCurrency?: string }).displayCurrency ?? "").toUpperCase();

        const needsMigration =
          persistedCountry === "IN" ||
          persistedMarket === "NSE" ||
          persistedMarket === "BSE" ||
          persistedCurrency === "INR";

        const selectedCountry: CountryCode = needsMigration ? defaultCountry : defaultCountry;
        const selectedMarket = needsMigration ? defaultMarket : normalizePersistedMarket(persisted.selectedMarket);
        const displayCurrency = needsMigration ? defaultCurrency : migratePersistedCurrency(persisted.displayCurrency);

        return {
          ...current,
          ...persisted,
          selectedCountry,
          selectedMarket,
          displayCurrency,
          themeVariant:
            persisted.themeVariant === "terminal-noir" ||
            persisted.themeVariant === "classic-bloomberg" ||
            persisted.themeVariant === "light-desk" ||
            persisted.themeVariant === "custom"
              ? persisted.themeVariant
              : current.themeVariant,
          customAccentColor:
            typeof persisted.customAccentColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(persisted.customAccentColor)
              ? persisted.customAccentColor.toUpperCase()
              : current.customAccentColor,
          hudOverlayEnabled:
            typeof persisted.hudOverlayEnabled === "boolean"
              ? persisted.hudOverlayEnabled
              : current.hudOverlayEnabled,
          recentSecurities: sanitizeRecentSecurities((persisted as Partial<SettingsState>).recentSecurities),
        };
      },
    },
  ),
);
