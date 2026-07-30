import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizePersistedMarket } from "../store/settingsStore";
import type { CountryCode, MarketCode } from "../types/markets";

describe("usMarketProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes legacy India markets to NASDAQ", () => {
    expect(normalizePersistedMarket("NSE")).toBe("NASDAQ");
    expect(normalizePersistedMarket("BSE")).toBe("NASDAQ");
    expect(normalizePersistedMarket("IN")).toBe("NASDAQ");
  });

  it("allows supported US exchange codes only", () => {
    const allowed: MarketCode[] = ["NYSE", "NASDAQ"];
    for (const market of allowed) {
      expect(normalizePersistedMarket(market)).toBe(market);
    }
  });

  it("maps unsupported former US venues to NASDAQ", () => {
    expect(normalizePersistedMarket("AMEX")).toBe("NASDAQ");
    expect(normalizePersistedMarket("CBOE")).toBe("NASDAQ");
    expect(normalizePersistedMarket("CME")).toBe("NASDAQ");
  });

  it("migrates persisted IN/NSE/INR settings and drops India recent symbols", async () => {
    localStorage.setItem(
      "ui-settings",
      JSON.stringify({
        state: {
          selectedCountry: "IN",
          selectedMarket: "NSE",
          displayCurrency: "INR",
          recentSecurities: [
            { symbol: "RELIANCE", name: "Reliance", assetClass: "equity", market: "IN", visitedAt: 1 },
            { symbol: "AAPL", name: "Apple", assetClass: "equity", market: "US", visitedAt: 2 },
          ],
        },
        version: 0,
      }),
    );

    vi.resetModules();
    const { useSettingsStore } = await import("../store/settingsStore");
    const state = useSettingsStore.getState();

    expect(state.selectedCountry).toBe("US");
    expect(state.selectedMarket).toBe("NASDAQ");
    expect(state.displayCurrency).toBe("USD");
    expect(state.recentSecurities.map((r) => r.symbol)).toEqual(["AAPL"]);
    expect(state.recentSecurities.every((r) => r.market === "US")).toBe(true);
  });

  it("does not require IN in market types", () => {
    const country: CountryCode = "US";
    const markets: MarketCode[] = ["NASDAQ", "NYSE"];
    expect(country).toBe("US");
    expect(markets).not.toContain("NSE" as MarketCode);
    expect(markets).not.toContain("BSE" as MarketCode);
    expect(markets).not.toContain("AMEX" as MarketCode);
  });
});
